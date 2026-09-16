'use server';

// ---------------------------------------------------------------------------
// Undo a split — put the sender's meal back and withdraw the offers
// ---------------------------------------------------------------------------
// A split rescales the sender's already-logged meal in place, which is
// destructive and, until now, one-way: the server then refuses to ever split
// that meal again. The success toast offers "Hoàn tác" for a few seconds and
// this is what it calls.
//
// Deliberately a COMPENSATING write, not a delayed one. The share is real the
// moment the button is pressed — a queued-then-cancelled write would mean a
// killed app silently drops a share the user was told had been sent.
//
// The five-second toast is UX. The real guard is "no invite has been accepted":
// once a friend has a copy in their diary, their meal is not ours to revoke,
// and the refusal has no time limit.

import { and, eq, inArray } from 'drizzle-orm';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { Errors } from '@/lib/core/errors/catalog';
import { undoMealShareSchema } from '@/lib/core/validation/social';
import { shareInviteKey } from '@/lib/domain/notifications/group-keys';
import { closeAggregates } from '@/lib/domain/notifications/notify';
import { withNotifications } from '@/lib/domain/notifications/with-notifications';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { mealItems, mealShareInvites, meals } from '@/lib/infra/db/schema';
import { scaleOwnMealInPlace } from './scale';

export async function undoMealShareAction(input: {
  mealId: string;
}): Promise<{ meal: PersistedMeal }> {
  const parsed = undoMealShareSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return withNotifications(db, async (tx, _notify) => {
    // Lock the meal first and scope it to the actor, matching the share path's
    // meal → invite lock order so an undo racing an accept cannot deadlock.
    const [source] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1)
      .for('update');
    if (!source) {
      throw Errors.notFound('Bữa ăn không tồn tại hoặc không thuộc về bạn.');
    }

    // Nothing was taken away, so there is nothing to give back. Covers a double
    // tap on the toast and an undo of a copy (which never scaled anything).
    if (source.portionFactor >= 1) {
      throw Errors.validationFailed('Bữa ăn này chưa được chia phần.');
    }

    // SPLIT invites I sent for this meal. Both halves of that scope matter.
    //
    // fromUserId, because an accepted split copy is itself a meal with
    // portionFactor < 1 — without the scope, undo would rescale the recipient's
    // own 35% share to a full portion in their diary.
    //
    // mode = 'split', because copy mode is allowed on a fractional meal: accept
    // a 35% share, copy-share it onward, and you own an outgoing invite that is
    // no evidence at all that you split anything. Only a split creates the
    // fractional state undo reverses.
    const invites = await tx
      .select({
        toUserId: mealShareInvites.toUserId,
        status: mealShareInvites.status,
      })
      .from(mealShareInvites)
      .where(
        and(
          eq(mealShareInvites.sourceMealId, source.id),
          eq(mealShareInvites.fromUserId, user.id),
          eq(mealShareInvites.mode, 'split')
        )
      );

    // No split offers means this meal's fraction did not come from a split I
    // made — an accepted share, or a portion edited by hand. Nothing to undo.
    if (invites.length === 0) {
      throw Errors.validationFailed('Bữa ăn này không phải do bạn chia phần.');
    }

    // The one refusal that matters. Their copy is already in their diary and
    // restoring ours would leave the dish counted one and a half times.
    //
    // Scoped to split invites for the same reason: an accepted COPY made before
    // the split is unrelated to it — that recipient took the meal as it stood,
    // and restoring mine puts the world back exactly as if I had never split.
    if (invites.some((i) => i.status === 'accepted')) {
      throw Errors.validationFailed(
        'Một người bạn đã nhận phần rồi — không thể hoàn tác.'
      );
    }

    // Restore by the reciprocal. The split guard requires a full portion
    // beforehand, so the meal was at 1 and this returns it there; the values
    // round-trip to a relative 1e-12, well under what the app ever displays.
    const itemRows = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));
    const meal = await scaleOwnMealInPlace(
      tx,
      source,
      itemRows,
      1 / source.portionFactor,
      1
    );

    // DELETE, not dismiss. "Dismissed" records a decision the recipient made;
    // they made none, and a withdrawn offer should leave no history on their
    // side at all. The unique (meal, recipient) index also means a later
    // re-share inserts cleanly rather than upserting onto a tombstone.
    const withdrawn = await tx
      .delete(mealShareInvites)
      .where(
        and(
          eq(mealShareInvites.sourceMealId, source.id),
          // The SAME scope as the lookup above, all three predicates. Without
          // mode='split' an undo also withdraws pending COPY offers made from
          // the same meal — offers the split never touched and that undoing it
          // has no business cancelling.
          eq(mealShareInvites.fromUserId, user.id),
          eq(mealShareInvites.mode, 'split'),
          inArray(mealShareInvites.status, ['pending', 'dismissed'])
        )
      )
      .returning({ toUserId: mealShareInvites.toUserId });

    // Close the notification in the same transaction that withdrew the offer,
    // exactly as the split's own auto-dismiss path does. Without this the card
    // sits in their feed pointing at a row that no longer exists.
    await closeAggregates(tx, {
      recipientIds: withdrawn.map((w) => w.toUserId),
      groupKey: shareInviteKey(source.id),
    });

    return { meal };
  });
}
