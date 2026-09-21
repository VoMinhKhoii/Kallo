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
// Structurally this is stageCheatRepeatAction (meals/cheat/occasions.ts) with
// a different source of authority: that one re-opens MY past occasion, this one
// re-opens a friend's, authorized solely by a pending invite addressed to me.

import { claimPendingInvite } from '@/lib/actions/meal-sharing/claim-invite';
import { stageCheatSliders } from '@/lib/actions/meals/cheat/stage-sliders';
import { Errors } from '@/lib/core/errors/catalog';
import type {
  CheatSlidersPersisted,
  StagedCheatAnalysis,
} from '@/lib/core/types/cheat';
import { stageCheatInviteSchema } from '@/lib/core/validation/social';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { shareInviteAcceptedKey } from '@/lib/domain/notifications/group-keys';
import { withNotifications } from '@/lib/domain/notifications/with-notifications';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';

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
  // same reason documented in cheat/confirm.ts).
  await assertFeatureAccess(
    { userId: user.id, profileCreatedAt: profile.createdAt },
    'cheat_meal'
  );

  return withNotifications(db, async (tx, notify) => {
    // Everything up to and including the claim is shared with the precise
    // accept path — see `claimPendingInvite` for the ordering rules it
    // enforces. Claiming at STAGE rather than at confirm is this path's own
    // decision: confirm is the generic save path and knows nothing about
    // invites, so leaving the invite pending until then would let the inbox
    // stage the same offer repeatedly. The cost is that abandoning the slider
    // card consumes the offer — but the staged row is not lost:
    // loadPendingAnalyses returns it for its day and the feed renders it as a
    // live card for about a week.
    //
    // `accepted_meal_id` stays NULL on this path. There is no meal yet, the
    // column is an FK so it cannot be pre-filled with an id the client has not
    // written, and nothing in the codebase reads it.
    const { invite, source, checked } = await claimPendingInvite(tx, {
      inviteId: parsed.inviteId,
      userId: user.id,
      // Shape-checked, not just non-null: a legacy row can carry `{spec}` with
      // no `levels`, and `withLevelsAsDefaults` would then throw a TypeError
      // AFTER the claim — a 500 where the honest answer is a refusal. Checked
      // here, before anything is written, so the invite survives.
      assertSource: (row) => {
        const persisted = row.cheatSliders as CheatSlidersPersisted | null;
        if (
          row.entryMode !== 'cheat' ||
          !Array.isArray(persisted?.spec?.sliders) ||
          typeof persisted.levels !== 'object' ||
          persisted.levels === null
        ) {
          throw Errors.validationFailed('Bữa ăn này không phải bữa xả.');
        }
        // Handed back as `checked`, already narrowed — the claim cannot
        // return without this having run.
        return persisted;
      },
    });

    // Their levels become MY defaults — the card opens where they landed, and
    // I move it from there rather than starting from the model's guess.
    //
    // Stamped at the SOURCE meal's instant, matching what an accepted precise
    // copy now does: this is the same eating event, seen from my diary. It also
    // keeps the staged row's time consistent with `spec.mealSlot`, which
    // withLevelsAsDefaults carried over from the sender and confirmCheatMeal
    // prefers over inference.
    const staged = await stageCheatSliders(tx, {
      userId: user.id,
      spec: checked.spec,
      levels: checked.levels,
      rawInput: source.rawInput,
      loggedAt: source.loggedAt,
    });

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

    return staged;
  });
}
