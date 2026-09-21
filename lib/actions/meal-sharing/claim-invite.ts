// ---------------------------------------------------------------------------
// Taking a directed meal-share offer — the part every path does identically
// ---------------------------------------------------------------------------
// Two actions consume a pending invite: `acceptMealShareInviteAction` copies
// the meal into the reader's diary, and `stageCheatInviteAction` reopens the
// sender's sliders instead. They diverge completely in what they WRITE, and
// not at all in how they get the right to write it. That prologue is the
// security-critical half, and it was duplicated line for line:
//
//   1. Discover the invite scoped to the ACTOR. This row is the entire
//      authorization for reading another user's meal — Drizzle bypasses RLS,
//      so nothing but this WHERE clause stands between the two diaries.
//   2. Lock the source meal FOR UPDATE. Meal-then-invite, the same order
//      `shareMealWithFriendsAction` takes, which is what keeps a take racing a
//      concurrent split from deadlocking.
//   3. Let the caller refuse the source BEFORE anything is claimed, so a
//      refusal leaves the offer takeable.
//   4. Claim the invite with a guarded `WHERE status = 'pending'`. This is the
//      double-tap guard: the second tap finds no pending row and 404s, having
//      written nothing.
//   5. Close the reader's own invite notification in the same transaction that
//      resolved the offer, and re-check the friendship still holds.
//
// Duplicated, that is five chances for the two paths to drift apart on a rule
// where drifting means leaking one user's meal to another. Here it is one
// function they both call, and a fix lands on both by construction.

import { and, eq, or } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import { shareInviteKey } from '@/lib/domain/notifications/group-keys';
import { closeAggregates } from '@/lib/domain/notifications/notify';
import type { AppTransaction } from '@/lib/infra/db/client';
import { friendships, mealShareInvites, meals } from '@/lib/infra/db/schema';

type MealRow = typeof meals.$inferSelect;

export interface ClaimedInvite<TChecked> {
  /** The sender, and which meal they offered. */
  invite: { sourceMealId: string; fromUserId: string };
  /** The locked source meal, read under the invite's authority. */
  source: MealRow;
  /**
   * The claim's own `copy_factor`, straight from `RETURNING`.
   *
   * It comes from the CLAIM and never from the discovery read: that read
   * happens before the source meal is locked, so a concurrent re-share can
   * take the lock, rescale the meal and upsert a new factor while this take
   * waits — and the pre-lock value would then scale the new source by the old
   * ratio. `RETURNING` is the only read atomic with the transition, so it is
   * the only one that can be trusted to match the source we just locked.
   *
   * Unvalidated. The column is NOT NULL with a `> 0` check, so only a schema
   * drift can make it unusable — but a caller that multiplies nutrition by it
   * must still refuse a non-finite or non-positive value rather than writing
   * NaN kcal into a diary. The cheat path has nothing to scale and ignores it.
   */
  copyFactor: number;
  /**
   * Whatever `assertSource` returned. It is the only place that has already
   * validated the source's shape, so handing its result back saves the caller
   * from re-deriving — or worse, re-asserting — what it just proved.
   */
  checked: TChecked;
}

/**
 * Claim a pending invite addressed to `userId`, returning the locked source.
 *
 * Throws — and therefore rolls the caller's transaction back — if the invite
 * is gone, already resolved, the source meal has been deleted, `assertSource`
 * refuses it, or the friendship no longer holds.
 *
 * Must run inside a transaction: the lock, the claim and the notification
 * close are only atomic together, and the caller's own write has to be able to
 * roll the claim back with it.
 */
export async function claimPendingInvite<TChecked = void>(
  tx: AppTransaction,
  options: {
    inviteId: string;
    /** The actor. Every query below is scoped to it. */
    userId: string;
    /**
     * Refuse a source this path cannot handle. Runs after the source is locked
     * and BEFORE the claim, so a refusal leaves the offer takeable — a client
     * on an old build that routes to the wrong action must not burn the
     * invite. Throw from here; whatever it returns comes back as `checked`.
     */
    assertSource: (source: MealRow) => TChecked;
  }
): Promise<ClaimedInvite<TChecked>> {
  const { inviteId, userId, assertSource } = options;

  const [invite] = await tx
    .select({
      sourceMealId: mealShareInvites.sourceMealId,
      fromUserId: mealShareInvites.fromUserId,
    })
    .from(mealShareInvites)
    .where(
      and(
        eq(mealShareInvites.id, inviteId),
        eq(mealShareInvites.toUserId, userId),
        eq(mealShareInvites.status, 'pending')
      )
    )
    .limit(1);
  if (!invite) {
    throw Errors.notFound('Lời mời không tồn tại hoặc đã được xử lý.');
  }

  // The authorized cross-user read. FOR UPDATE serializes it against split and
  // edit, so meal totals and item rows come from one coherent portion.
  const [source] = await tx
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.id, invite.sourceMealId),
        eq(meals.userId, invite.fromUserId)
      )
    )
    .limit(1)
    .for('update');
  if (!source) {
    throw Errors.notFound('Bữa ăn không còn tồn tại.');
  }

  const checked = assertSource(source);

  const [claimed] = await tx
    .update(mealShareInvites)
    .set({ status: 'accepted', respondedAt: new Date() })
    .where(
      and(
        eq(mealShareInvites.id, inviteId),
        eq(mealShareInvites.toUserId, userId),
        eq(mealShareInvites.status, 'pending')
      )
    )
    .returning({
      id: mealShareInvites.id,
      copyFactor: mealShareInvites.copyFactor,
    });
  if (!claimed) {
    throw Errors.notFound('Lời mời không tồn tại hoặc đã được xử lý.');
  }

  // Closed here, in the tx that resolved the offer, so EVERY resolution path
  // closes the aggregate — this card, the Circle page, another device, or the
  // sender's split auto-dismiss. A fresh re-offer then INSERTs new history
  // instead of rewriting this row.
  await closeAggregates(tx, {
    recipientIds: [userId],
    groupKey: shareInviteKey(invite.sourceMealId),
  });

  // The offer was made under an accepted friendship — re-check it still holds
  // (the sender may have been unfriended or blocked since). Throwing rolls the
  // claim back along with everything else.
  const [friend] = await tx
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.userLow, userId),
            eq(friendships.userHigh, invite.fromUserId)
          ),
          and(
            eq(friendships.userHigh, userId),
            eq(friendships.userLow, invite.fromUserId)
          )
        )
      )
    )
    .limit(1);
  if (!friend) {
    throw Errors.validationFailed('Bạn không còn là bạn bè với người này.');
  }

  return { invite, source, copyFactor: claimed.copyFactor, checked };
}
