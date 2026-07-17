'use server';

// ---------------------------------------------------------------------------
// Meal-share reaction toggle
// ---------------------------------------------------------------------------

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { mealShareReactions, mealShares } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { canViewShare } from '@/lib/groups/share-visibility';

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

  return db.transaction(async (tx) => {
    if (!(await canViewShare(user.id, parsed.shareId, tx))) {
      throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    }

    // Serialize concurrent toggles on this share. Without the row lock two
    // taps from "off" both see no deletion and both insert (onConflictDoNothing
    // then leaves it "on" instead of cancelling); locking forces the second
    // toggle to observe the first's row and delete it.
    await tx
      .select({ id: mealShares.id })
      .from(mealShares)
      .where(eq(mealShares.id, parsed.shareId))
      .for('update');

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
}
