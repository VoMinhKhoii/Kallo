'use server';

// ---------------------------------------------------------------------------
// Respond to a received meal-share invite — accept or dismiss
// ---------------------------------------------------------------------------
// Accept materializes the sender's meal in the reader's own diary. It performs
// a deliberate cross-user meal read, authorized solely by a pending invite row
// addressed to the reader. The copy is verbatim: a split's share was already
// baked into the source when the offer was made (see share-with-friends), so
// re-applying portion_factor here would double-scale. Broadcast copies use the
// separate canViewShare-gated log-shared action instead.

import { and, eq } from 'drizzle-orm';
import {
  bindInviteToMeal,
  claimPendingInvite,
} from '@/lib/actions/meal-sharing/invite-lifecycle';
import { copyMealVerbatim } from '@/lib/actions/meals/copy-meal-verbatim';
import type { ConfirmMealResponse } from '@/lib/actions/meals/types';
import { Errors } from '@/lib/core/errors/catalog';
import {
  acceptMealShareInviteSchema,
  dismissMealShareInviteSchema,
} from '@/lib/core/validation/social';
import {
  shareInviteAcceptedKey,
  shareInviteKey,
} from '@/lib/domain/notifications/group-keys';
import { closeAggregates } from '@/lib/domain/notifications/notify';
import { withNotifications } from '@/lib/domain/notifications/with-notifications';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { mealItems, mealShareInvites } from '@/lib/infra/db/schema';

// ---------------------------------------------------------------------------
// S3: Accept an invite — materialize the meal in my own diary
// ---------------------------------------------------------------------------

export async function acceptMealShareInviteAction(input: {
  inviteId: string;
  newMealId?: string;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<ConfirmMealResponse> {
  const parsed = acceptMealShareInviteSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  // No premium gate here on purpose: the INITIATOR pays. By the time an invite
  // exists a split has already halved the sender's meal, so refusing the
  // recipient would strand that half against an offer they can never take.
  return withNotifications(db, async (tx, notify) => {
    // Everything up to and including the claim is shared with the cheat path —
    // see `claimPendingInvite` for the ordering rules it enforces.
    const { invite, source, copyFactor } = await claimPendingInvite(tx, {
      inviteId: parsed.inviteId,
      userId: user.id,
      // A cheat invite is not accepted here — it reopens the sender's sliders
      // so I can set my own amounts (stageCheatInviteAction). Refused BEFORE
      // the claim, so a client on an old build that routes here leaves the
      // invite pending and can still take it properly after updating. Without
      // this the cheat source would fall through to the item-count check below
      // and blame "no items", which is true but useless.
      assertSource: (row) => {
        if (row.entryMode === 'cheat') {
          throw Errors.validationFailed(
            'Bữa xả cần bạn tự đặt mức — hãy mở thẻ thanh trượt.'
          );
        }
      },
    });

    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));
    if (sourceItems.length === 0) {
      throw Errors.validationFailed('Bữa ăn này không có món để thêm.');
    }

    // The SAME eating event, seen from my diary — so it keeps the sender's
    // instant and their slot rather than being restamped "now".
    //
    // This used to be `getUtcInstantForLocalDate(loggedDate, timezoneOffset)`,
    // which took the day from my chosen date but the CLOCK from the moment I
    // tapped accept: a friend's 07:00 breakfast accepted at 21:00 landed in my
    // diary as a 21:00 dinner, because the slot was then re-inferred from that
    // instant. `loggedDate`/`timezoneOffset` are still accepted (shipped mobile
    // builds send them) and deliberately ignored — neither client ever offered
    // a date picker here, both hardcode today, so nothing is lost by taking the
    // source's date too.
    //
    // Cross-timezone: the copy is the same INSTANT, so for a recipient far
    // enough away it can fall on the adjacent local day. That is correct, and
    // unavoidable — `meals` stores no sender offset to reconstruct their wall
    // clock from.
    const loggedAt = source.loggedAt;
    // Materialize the sender's meal in my diary, scaled by the invite's
    // `copy_factor` — the ratio between my run and the sender's REMAINING run.
    //
    // An EVEN split leaves those two runs equal, so the factor is 1 and this is
    // the verbatim copy the shipped code performed; that is also what every
    // pre-existing row defaults to. An UNEVEN split is the case verbatim got
    // wrong: the sender scaled themselves to their own share up front, and my
    // share is a different fraction of the same dish, so copying their meal
    // unscaled would hand me their portion instead of mine.
    //
    // Guarded, not trusted: every nutrition column is `value * factor`, so a
    // NaN or non-positive factor would write NaN kcal into the reader's diary
    // and corrupt every total that day — silently, and unrecoverably. The
    // column is NOT NULL with a `> 0` check, so this can only fire on a schema
    // drift, which is exactly when you want a refusal instead of a write.
    if (!Number.isFinite(copyFactor) || copyFactor <= 0) {
      throw Errors.validationFailed('Phần được chia không hợp lệ.');
    }

    const { mealId, meal } = await copyMealVerbatim(tx, source, sourceItems, {
      factor: copyFactor,
      userId: user.id,
      newMealId: parsed.newMealId,
      loggedAt,
      mealSlot: source.mealSlot,
    });

    // Point the already-claimed invite at the materialized meal — the same
    // write the cheat path makes at confirm, so "took it and ate it" looks
    // identical however the offer was taken.
    await bindInviteToMeal(tx, { inviteId: parsed.inviteId, mealId });

    // Tell the sender their offer landed. A dismiss deliberately stays silent
    // (LinkedIn norm: no rejection signal).
    await notify([
      {
        recipientId: invite.fromUserId,
        type: 'share.invite_accepted',
        actorId: user.id,
        objectType: 'invite',
        objectId: parsed.inviteId,
        groupKey: shareInviteAcceptedKey(parsed.inviteId),
      },
    ]);

    return { mealId, meal };
  });
}

// ---------------------------------------------------------------------------
// S4: Dismiss an invite
// ---------------------------------------------------------------------------

export async function dismissMealShareInviteAction(input: {
  inviteId: string;
}): Promise<{ success: true }> {
  const parsed = dismissMealShareInviteSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  // Ungated for the same reason as accept: responding to someone else's offer
  // is never the billable action.
  //
  // Transactional so the guarded dismiss and the notification close land
  // together: a dismiss that committed while the close failed would leave an
  // open aggregate for an offer that no longer exists, and a later re-offer
  // would rewrite that row instead of opening fresh history.
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(mealShareInvites)
      .set({ status: 'dismissed', respondedAt: new Date() })
      .where(
        and(
          eq(mealShareInvites.id, parsed.inviteId),
          eq(mealShareInvites.toUserId, user.id),
          eq(mealShareInvites.status, 'pending')
        )
      )
      .returning({
        id: mealShareInvites.id,
        // The notification aggregates on the SOURCE meal, not the invite.
        sourceMealId: mealShareInvites.sourceMealId,
      });
    if (!updated) {
      throw Errors.notFound('Lời mời không tồn tại hoặc đã được xử lý.');
    }

    // Same close as accept: a dismiss from Circle or another device resolves
    // the offer just as finally as one from the Activity card, so the card is
    // not the only thing that can read this row.
    await closeAggregates(tx, {
      recipientIds: [user.id],
      groupKey: shareInviteKey(updated.sourceMealId),
    });

    return { success: true };
  });
}
