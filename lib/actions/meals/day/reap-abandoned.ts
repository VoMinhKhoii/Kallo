import { and, eq } from 'drizzle-orm';
import { releaseInvite } from '@/lib/actions/meal-sharing/invite-lifecycle';
import { isAbandoned } from '@/lib/actions/meals/day/abandoned';
import { db } from '@/lib/infra/db/client';
import { pendingAnalyses } from '@/lib/infra/db/schema';

/** What one sweep did, so the day load can account for it. */
export interface ReapOutcome {
  /**
   * Ids of the staged cards this sweep deleted. The day read runs CONCURRENTLY
   * with the sweep and does not filter on `expiresAt` at all, so it can and
   * does return a row this sweep is deleting — `loadLoggingDay` subtracts these
   * so it never hands back a card that no longer exists.
   */
  reapedIds: string[];
  /**
   * True when at least one reaped card handed a meal-share offer back. The
   * offer returns to the recipient's inbox as a side effect of loading a day,
   * so the caller has to refresh the inbox caches; nothing else will.
   */
  releasedInvites: boolean;
}

const NOTHING_REAPED: ReapOutcome = { reapedIds: [], releasedInvites: false };

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
 * it actually needs, and a failed purge must not cost someone their day. A
 * failure reports `NOTHING_REAPED`, which is the truthful answer for the
 * caller — the rows are still there, so the day should still show them. The
 * cost of the transaction is that a failure now aborts the whole sweep for
 * that user rather than one row — acceptable, because the only realistic
 * failure is the connection itself (the UPDATE cannot violate the status CHECK
 * or the `(source_meal_id, to_user_id)` unique index), and the next day load
 * runs it again.
 */
export async function reapAbandonedPendingAnalyses(
  userId: string
): Promise<ReapOutcome> {
  try {
    return await db.transaction(async (tx) => {
      const reaped = await tx
        .delete(pendingAnalyses)
        .where(and(eq(pendingAnalyses.userId, userId), isAbandoned()))
        .returning({
          id: pendingAnalyses.id,
          sourceInviteId: pendingAnalyses.sourceInviteId,
        });

      let releasedInvites = false;
      for (const row of reaped) {
        if (row.sourceInviteId) {
          await releaseInvite(tx, { inviteId: row.sourceInviteId, userId });
          releasedInvites = true;
        }
      }

      return { reapedIds: reaped.map((row) => row.id), releasedInvites };
    });
  } catch (error) {
    console.error(
      '[loadLoggingDay] failed to reap abandoned pending analyses',
      {
        userId,
        error,
      }
    );
    return NOTHING_REAPED;
  }
}
