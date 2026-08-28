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

import { and, eq, or } from 'drizzle-orm';
import { after } from 'next/server';
import { copyMealVerbatim } from '@/lib/actions/meals/copy-meal-verbatim';
import type { ConfirmMealResponse } from '@/lib/actions/meals/types';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import {
  acceptMealShareInviteSchema,
  dismissMealShareInviteSchema,
} from '@/lib/core/validation/social';
import { closeInviteNotification } from '@/lib/domain/notifications/close-invite-notification';
import { shareInviteAcceptedKey } from '@/lib/domain/notifications/group-keys';
import { notify } from '@/lib/domain/notifications/notify';
import { sendNotificationPush } from '@/lib/domain/notifications/push';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import {
  friendships,
  mealItems,
  mealShareInvites,
  meals,
} from '@/lib/infra/db/schema';

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
  let pushRecipients: string[] = [];

  const accepted = await db.transaction(async (tx) => {
    // Discover the actor-scoped pending invite before touching cross-user data.
    // The source meal is then locked BEFORE the invite is claimed, matching the
    // split path's meal -> invite lock order and avoiding an accept/split
    // deadlock while still keeping the final claim atomic.
    const [invite] = await tx
      .select({
        sourceMealId: mealShareInvites.sourceMealId,
        fromUserId: mealShareInvites.fromUserId,
      })
      .from(mealShareInvites)
      .where(
        and(
          eq(mealShareInvites.id, parsed.inviteId),
          eq(mealShareInvites.toUserId, user.id),
          eq(mealShareInvites.status, 'pending')
        )
      )
      .limit(1);
    if (!invite) {
      throw Errors.notFound('Lời mời không tồn tại hoặc đã được xử lý.');
    }

    // Authorized cross-user read: the actor-scoped invite above grants this
    // single source read. FOR UPDATE serializes it against split/edit, so meal
    // totals and item rows come from one coherent portion.
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

    // Atomically claim after the source lock. A concurrent accept loses this
    // guarded update after waiting and cannot materialize a second copy.
    const claimed = await tx
      .update(mealShareInvites)
      .set({ status: 'accepted', respondedAt: new Date() })
      .where(
        and(
          eq(mealShareInvites.id, parsed.inviteId),
          eq(mealShareInvites.toUserId, user.id),
          eq(mealShareInvites.status, 'pending')
        )
      )
      .returning({ id: mealShareInvites.id });
    if (!claimed[0]) {
      throw Errors.notFound('Lời mời không tồn tại hoặc đã được xử lý.');
    }

    // Close my own invite notification here, in the tx that resolved the offer,
    // so EVERY resolution path closes the aggregate — this card, the Circle
    // page, another device, or the sender's split auto-dismiss. A fresh
    // re-offer then INSERTs new history instead of rewriting this row. The
    // Activity card's markRead is a harmless second close (read_at IS NULL).
    await closeInviteNotification(tx, {
      recipientId: user.id,
      sourceMealId: invite.sourceMealId,
    });

    // The offer was created under an accepted friendship — re-check it still
    // holds (the sender may have been unfriended or blocked since). Rolls back.
    const [friend] = await tx
      .select({ id: friendships.id })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(
              eq(friendships.userLow, user.id),
              eq(friendships.userHigh, invite.fromUserId)
            ),
            and(
              eq(friendships.userHigh, user.id),
              eq(friendships.userLow, invite.fromUserId)
            )
          )
        )
      )
      .limit(1);
    if (!friend) {
      throw Errors.validationFailed('Bạn không còn là bạn bè với người này.');
    }

    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));
    if (sourceItems.length === 0) {
      throw Errors.validationFailed('Bữa ăn này không có món để thêm.');
    }

    // A brand-new eating event "now" on my chosen day (slot inferred fresh).
    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );
    // Materialize the sender's meal in my diary — verbatim, no re-scaling (a
    // split's share is already baked into the source's stored values). Shared
    // helper — the same copy the "log again" path performs.
    const { mealId, meal } = await copyMealVerbatim(tx, source, sourceItems, {
      factor: 1,
      userId: user.id,
      newMealId: parsed.newMealId,
      loggedAt,
    });

    // Point the already-claimed invite at the materialized meal.
    await tx
      .update(mealShareInvites)
      .set({ acceptedMealId: mealId })
      .where(eq(mealShareInvites.id, parsed.inviteId));

    // Tell the sender their offer landed. A dismiss deliberately stays silent
    // (LinkedIn norm: no rejection signal).
    pushRecipients = await notify(tx, [
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

  after(() =>
    sendNotificationPush(pushRecipients, {
      type: 'share.invite_accepted',
      actorId: user.id,
      groupKey: shareInviteAcceptedKey(parsed.inviteId),
    })
  );
  return accepted;
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
    await closeInviteNotification(tx, {
      recipientId: user.id,
      sourceMealId: updated.sourceMealId,
    });

    return { success: true };
  });
}
