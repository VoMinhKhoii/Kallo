'use server';

// ---------------------------------------------------------------------------
// Meal-share reaction toggle
// ---------------------------------------------------------------------------

import { and, eq, sql } from 'drizzle-orm';
import { after } from 'next/server';
import { z } from 'zod';
import { Errors } from '@/lib/core/errors/catalog';
import { shareReactionKey } from '@/lib/domain/notifications/group-keys';
import { notify, retractActor } from '@/lib/domain/notifications/notify';
import { sendNotificationPush } from '@/lib/domain/notifications/push';
import { canViewShareOwnedBy } from '@/lib/domain/social/shares/share-visibility';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { mealShareReactions, mealShares } from '@/lib/infra/db/schema';

const toggleShareReactionSchema = z.object({
  shareId: z.string().uuid('shareId phải là UUID hợp lệ.').toLowerCase(),
});

/**
 * Toggle the authenticated viewer's v1 heart. canViewShare is the primary
 * tenant boundary; the unique pair is the concurrency backstop that prevents
 * duplicate reactions from double taps or multiple devices.
 */
export async function toggleShareReactionAction(input: {
  shareId: string;
}): Promise<{ reacted: boolean; count: number }> {
  const parsed = toggleShareReactionSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Only a reaction turning ON pushes; un-reacting is silent by design.
  let pushRecipients: string[] = [];

  const result = await db.transaction(async (tx) => {
    // Serialize concurrent toggles on this share. Without the row lock two
    // taps from "off" both see no deletion and both insert (onConflictDoNothing
    // then leaves it "on" instead of cancelling); locking forces the second
    // toggle to observe the first's row and delete it.
    const lockedShares = await tx
      .select({
        id: mealShares.id,
        actorId: mealShares.actorId,
        sharedAt: mealShares.sharedAt,
        visibility: mealShares.visibility,
      })
      .from(mealShares)
      .where(eq(mealShares.id, parsed.shareId))
      .for('update');
    if (lockedShares.length === 0) {
      throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    }
    if (!(await canViewShareOwnedBy(user.id, lockedShares[0], tx))) {
      throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    }

    const deleted = await tx
      .delete(mealShareReactions)
      .where(
        and(
          eq(mealShareReactions.shareId, parsed.shareId),
          eq(mealShareReactions.userId, user.id)
        )
      )
      .returning({ id: mealShareReactions.id });

    if (deleted.length === 0) {
      await tx
        .insert(mealShareReactions)
        .values({
          shareId: parsed.shareId,
          userId: user.id,
          kind: 'heart',
        })
        .onConflictDoNothing({
          target: [mealShareReactions.shareId, mealShareReactions.userId],
        })
        .returning({ id: mealShareReactions.id });
      // Aggregates per share: ten hearts are one row, "X and 9 others".
      pushRecipients = await notify(tx, [
        {
          recipientId: lockedShares[0].actorId,
          type: 'share.reaction',
          actorId: user.id,
          objectType: 'share',
          objectId: parsed.shareId,
          groupKey: shareReactionKey(parsed.shareId),
        },
      ]);
    } else {
      // Un-reacting withdraws this actor from the still-open aggregate (and
      // deletes the row at zero); a read row is history and stays untouched.
      await retractActor(tx, {
        recipientId: lockedShares[0].actorId,
        groupKey: shareReactionKey(parsed.shareId),
        actorId: user.id,
      });
    }

    const [summary] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        mine: sql<boolean>`bool_or(${mealShareReactions.userId} = ${user.id})`,
      })
      .from(mealShareReactions)
      .where(eq(mealShareReactions.shareId, parsed.shareId));

    return {
      reacted: Boolean(summary?.mine),
      count: Number(summary?.count ?? 0),
    };
  });

  after(() =>
    sendNotificationPush(pushRecipients, {
      type: 'share.reaction',
      actorId: user.id,
      groupKey: shareReactionKey(parsed.shareId),
    })
  );
  return result;
}
