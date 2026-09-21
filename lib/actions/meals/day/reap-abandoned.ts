import { and, eq, sql } from 'drizzle-orm';
import { releaseInvite } from '@/lib/actions/meal-sharing/invite-lifecycle';
import { db } from '@/lib/infra/db/client';
import { pendingAnalyses } from '@/lib/infra/db/schema';

/**
 * Purge a user's long-abandoned staged cards, handing back any offers they owe.
 *
 * `expires_at` defaults to 30 minutes but stopped hiding a card years ago — it
 * is purely this sweep's input now, so a staged row's real lifetime is about a
 * week (see `loadPendingAnalyses`). What gets deleted here is a card nobody
 * came back to.
 *
 * Transactional, and that is the whole reason this stopped being three lines:
 * a card staged from a friend's cheat offer SPENT that offer when it was taken
 * — the invite flipped to `accepted` before any meal existed — so reaping the
 * card is the last moment anyone could notice the offer went nowhere. Without
 * the release, the discard path fixed the dead end only for people who
 * dismissed the card on purpose; anyone who simply walked away from it still
 * lost the meal, seven days later instead of immediately.
 *
 * Best-effort and never throws: `loadLoggingDay` runs it alongside the reads
 * it actually needs, and a failed purge must not cost someone their day. The
 * cost of the transaction is that a failure now aborts the whole sweep for
 * that user rather than one row — acceptable, because the only realistic
 * failure is the connection itself (the UPDATE cannot violate the status CHECK
 * or the `(source_meal_id, to_user_id)` unique index), and the next day load
 * runs it again.
 */
export async function reapAbandonedPendingAnalyses(
  userId: string
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const reaped = await tx
        .delete(pendingAnalyses)
        .where(
          and(
            eq(pendingAnalyses.userId, userId),
            sql`${pendingAnalyses.expiresAt} < now() - interval '7 days'`
          )
        )
        .returning({ sourceInviteId: pendingAnalyses.sourceInviteId });

      for (const row of reaped) {
        if (row.sourceInviteId) {
          await releaseInvite(tx, { inviteId: row.sourceInviteId, userId });
        }
      }
    });
  } catch (error) {
    console.error(
      '[loadLoggingDay] failed to reap abandoned pending analyses',
      {
        userId,
        error,
      }
    );
  }
}
