'use server';

// ---------------------------------------------------------------------------
// Take a cheat-meal invite by reopening the sender's sliders
// ---------------------------------------------------------------------------
// A cheat meal has no item rows to reproduce — its numbers come from where the
// sender put four sliders. Copying those numbers verbatim would assert that I
// ate exactly what they ate, which is the one thing a cheat occasion is least
// likely to mean: two people at the same buffet rarely had the same amount.
//
// So taking a cheat invite does not materialize a meal. It re-stages the
// sender's slider spec — seeded with THEIR levels as my starting position — as
// a pending_analyses row of my own, and the ordinary cheat slider card opens on
// it. Adjusting and confirming then runs the untouched confirmAndSaveMealAction
// -> confirmCheatMeal path, so nothing about how a cheat meal is saved changes.
//
// Structurally this is stageCheatRepeatAction (lib/actions/meals/cheat.ts) with
// a different source of authority: that one re-opens MY past occasion, this one
// re-opens a friend's, authorized solely by a pending invite addressed to me.

import { and, eq, or } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import type {
  CheatSlidersPersisted,
  StagedCheatAnalysis,
} from '@/lib/core/types/cheat';
import { stageCheatInviteSchema } from '@/lib/core/validation/social';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { withLevelsAsDefaults } from '@/lib/domain/cheat/slider-nutrition';
import {
  shareInviteAcceptedKey,
  shareInviteKey,
} from '@/lib/domain/notifications/group-keys';
import { closeAggregates } from '@/lib/domain/notifications/notify';
import { withNotifications } from '@/lib/domain/notifications/with-notifications';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import {
  friendships,
  mealShareInvites,
  meals,
  pendingAnalyses,
} from '@/lib/infra/db/schema';

export async function stageCheatInviteAction(input: {
  inviteId: string;
}): Promise<StagedCheatAnalysis> {
  const parsed = stageCheatInviteSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();

  // Gated HERE, before the invite is consumed, and not at confirm.
  //
  // Confirming any cheat meal is already `cheat_meal`-gated
  // (assertCheatConfirmAllowed, called from confirmAndSaveMealAction), so this
  // adds no new charge — it just moves the wall somewhere survivable. Without
  // it a free recipient would spend their invite, land on the logging feed,
  // dial four sliders and only THEN meet a 402, with the offer already gone.
  //
  // Outside the transaction on purpose: DB_POOL_MAX defaults to 2, so an
  // entitlement read inside an open transaction can deadlock the pool (the
  // same reason documented in confirm-cheat.ts).
  await assertFeatureAccess(
    { userId: user.id, profileCreatedAt: profile.createdAt },
    'cheat_meal'
  );

  return withNotifications(db, async (tx, notify) => {
    // Actor-scoped discovery before any cross-user read: this row is the whole
    // authorization for reading someone else's meal below.
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

    // Lock the source BEFORE claiming the invite. Same meal -> invite order as
    // acceptMealShareInviteAction and shareMealWithFriendsAction, which is what
    // keeps a stage racing a concurrent split from deadlocking.
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
    if (source.entryMode !== 'cheat' || !source.cheatSliders) {
      throw Errors.validationFailed('Bữa ăn này không phải bữa xả.');
    }

    // Claim atomically. This is the double-tap guard: a second tap finds no
    // pending row and 404s, having staged nothing, so one invite can never
    // produce two slider cards and therefore never two logged meals.
    //
    // Claiming here rather than at confirm is deliberate. Confirm is the
    // generic save path and knows nothing about invites; leaving the invite
    // pending until then would let the inbox stage the same offer repeatedly.
    // The cost is that abandoning the card consumes the offer — but the staged
    // row is not lost: loadPendingAnalyses returns it for its day and the feed
    // renders it as a live card for about a week.
    //
    // `accepted_meal_id` stays NULL on this path. There is no meal yet, the
    // column is an FK so it cannot be pre-filled with an id the client has not
    // written, and nothing in the codebase reads it.
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

    // Close my own invite notification in the tx that resolved the offer, so a
    // later re-offer inserts fresh history instead of rewriting this row.
    await closeAggregates(tx, {
      recipientIds: [user.id],
      groupKey: shareInviteKey(invite.sourceMealId),
    });

    // The offer was made under an accepted friendship — re-check it still
    // holds. Throwing rolls back the claim along with everything else.
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

    // Their levels become MY defaults — the card opens where they landed, and
    // I move it from there rather than starting from the model's guess.
    const { spec, levels } = source.cheatSliders as CheatSlidersPersisted;
    const repeatSpec = withLevelsAsDefaults(spec, levels);

    // Stamped at the SOURCE meal's instant, matching what an accepted precise
    // copy now does: this is the same eating event, seen from my diary. It also
    // keeps the staged row's time consistent with `spec.mealSlot`, which
    // withLevelsAsDefaults carried over from the sender and confirmCheatMeal
    // prefers over inference.
    const loggedAt = source.loggedAt;

    const [inserted] = await tx
      .insert(pendingAnalyses)
      .values({
        userId: user.id,
        pipelineResult: { entryMode: 'cheat', spec: repeatSpec },
        rawInput: source.rawInput,
        entryMode: 'cheat',
        loggedAt,
      })
      .returning({ id: pendingAnalyses.id });

    // Tell the sender their offer landed. Fired now, when I TAKE the offer,
    // rather than when I finish dialing it — the offer is spent at this point
    // either way, and deferring it would mean threading invite identity
    // through the generic confirm path.
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

    return {
      analysisId: inserted.id,
      spec: repeatSpec,
      rawInput: source.rawInput,
      loggedAt: loggedAt.toISOString(),
    };
  });
}
