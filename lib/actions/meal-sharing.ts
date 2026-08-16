'use server';

// ---------------------------------------------------------------------------
// Share a meal between friends — copy & split
// ---------------------------------------------------------------------------
// A directed layer on top of the broadcast meal_shares: the logger offers one of
// their own meals to specific friends, either as a full COPY (everyone logs the
// same dish) or a SPLIT (one physical item divided equally — e.g. one milk tea
// between two people). A split scales the logger's OWN meal down to their share
// up front, so accept is a plain verbatim copy of the source meal as it now
// stands — the recipient's portion is already baked in. portion_factor is kept
// for the inbox label only; it is never re-applied at accept time (that would
// double-scale). Every query is re-scoped to the actor (Drizzle bypasses RLS);
// this module's accept path performs a deliberate cross-user meal read,
// authorized solely by a pending invite row addressed to the reader. Broadcast
// copies use the separate canViewShare-gated log-shared action.

import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { scaleOwnMealInPlace } from '@/lib/actions/meal-sharing/scale';
import { copyMealVerbatim } from '@/lib/actions/meals/copy-meal-verbatim';
import { requireAuthAndProfile } from '@/lib/auth/session';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import {
  friendships,
  mealItems,
  mealShareInvites,
  meals,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors/catalog';
import {
  acceptMealShareInviteSchema,
  dismissMealShareInviteSchema,
  shareMealWithFriendsSchema,
} from '@/lib/validation/social';
import type { ConfirmMealResponse, PersistedMeal } from './meals/types';

// A "use server" module may only export async server actions — no value or type
// re-exports. Consumers import listMealShareInvitesAction / MealShareInvite
// directly from ./meal-sharing/{invites-list,types}.

// ---------------------------------------------------------------------------
// S1: Share a meal with friends (copy or split)
// ---------------------------------------------------------------------------

export async function shareMealWithFriendsAction(input: {
  mealId: string;
  friendUserIds: string[];
  mode: 'copy' | 'split';
}): Promise<{
  invitedCount: number;
  portionFactor: number;
  /** The rescaled source meal for a split (so the card reconciles); null for a
   *  copy, which leaves the logger's meal untouched. */
  meal: PersistedMeal | null;
}> {
  const parsed = shareMealWithFriendsSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Dedup and drop self — you cannot share a meal with yourself.
  const recipientIds = Array.from(new Set(parsed.friendUserIds)).filter(
    (id) => id !== user.id
  );
  if (recipientIds.length === 0) {
    throw Errors.validationFailed('Hãy chọn ít nhất một người bạn.');
  }

  return await db.transaction(async (tx) => {
    // Ownership + precise gate (mirrors duplicateMealAction). Cheat meals carry
    // no item rows, so there is nothing to copy or split. Locked FOR UPDATE so
    // two concurrent splits can't both read portionFactor = 1 and each scale
    // the same meal from the stale full portion.
    const [source] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1)
      .for('update');
    if (!source) {
      throw Errors.notFound('Bữa ăn không tồn tại hoặc không thuộc về bạn.');
    }
    if (source.entryMode === 'cheat') {
      throw Errors.validationFailed('Không thể chia sẻ bữa xả theo cách này.');
    }

    // Copy/split reproduce the item rows — a meal with none has nothing to give
    // (mirrors the client gate; the API is the mobile contract, so enforce here).
    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));
    if (sourceItems.length === 0) {
      throw Errors.validationFailed('Bữa ăn này không có món để chia sẻ.');
    }

    // A split may only halve a natural full portion once. Splitting an already-
    // fractional meal (a prior split, or an accepted split copy) would compound
    // the shrink — refuse rather than silently double-scale the logger's meal.
    if (parsed.mode === 'split' && source.portionFactor < 1) {
      throw Errors.validationFailed('Bữa ăn này đã được chia phần rồi.');
    }

    // A split must also be rejected when any selected friend already ACCEPTED
    // an offer for this meal: the upsert below deliberately never resets an
    // accepted invite (no duplicate logs), so scaling first would shrink the
    // sender's meal while creating no pending offer for that friend.
    if (parsed.mode === 'split') {
      const accepted = await tx
        .select({ toUserId: mealShareInvites.toUserId })
        .from(mealShareInvites)
        .where(
          and(
            eq(mealShareInvites.sourceMealId, source.id),
            inArray(mealShareInvites.toUserId, recipientIds),
            eq(mealShareInvites.status, 'accepted')
          )
        )
        .limit(1);
      if (accepted[0]) {
        throw Errors.validationFailed(
          'Một người bạn đã nhận phần bữa này rồi — không thể chia thêm.'
        );
      }
    }

    // Every recipient must be an accepted friend of the actor. One query over
    // the canonical friendship edges; anyone not accepted is rejected outright.
    const acceptedRows = await tx
      .select({
        userLow: friendships.userLow,
        userHigh: friendships.userHigh,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(
              eq(friendships.userLow, user.id),
              inArray(friendships.userHigh, recipientIds)
            ),
            and(
              eq(friendships.userHigh, user.id),
              inArray(friendships.userLow, recipientIds)
            )
          )
        )
      );
    const acceptedFriendIds = new Set(
      acceptedRows.map((r) => (r.userLow === user.id ? r.userHigh : r.userLow))
    );
    if (recipientIds.some((id) => !acceptedFriendIds.has(id))) {
      throw Errors.validationFailed(
        'Chỉ có thể chia sẻ với bạn bè đã kết nối.'
      );
    }

    // participants = the actor plus everyone they are splitting with.
    const portionFactor =
      parsed.mode === 'split' ? 1 / (recipientIds.length + 1) : 1;

    // A split reduces the actor to their own share; a copy leaves it untouched.
    const meal =
      parsed.mode === 'split'
        ? await scaleOwnMealInPlace(tx, source, sourceItems, portionFactor)
        : null;

    // Upsert one pending invite per recipient. Re-sharing re-pends a prior
    // DISMISSED offer, but the setWhere leaves an already-ACCEPTED invite
    // untouched — resetting it would re-prompt the friend and let them log a
    // second copy of the same meal.
    const now = new Date();
    await tx
      .insert(mealShareInvites)
      .values(
        recipientIds.map((toUserId) => ({
          sourceMealId: source.id,
          fromUserId: user.id,
          toUserId,
          mode: parsed.mode,
          portionFactor: String(portionFactor),
        }))
      )
      .onConflictDoUpdate({
        target: [mealShareInvites.sourceMealId, mealShareInvites.toUserId],
        set: {
          mode: parsed.mode,
          portionFactor: String(portionFactor),
          status: 'pending',
          acceptedMealId: null,
          respondedAt: null,
          createdAt: now,
        },
        setWhere: sql`${mealShareInvites.status} <> 'accepted'`,
      });

    // A split just shrank the source in place. Accept copies the source
    // verbatim (its current fraction), so any OTHER still-pending invite for
    // this meal — e.g. a copy sent to someone not in this split — would now
    // silently deliver the halved portion under a "full copy" label. Dismiss
    // those stragglers; the recipients of THIS split were just re-pended above.
    if (parsed.mode === 'split') {
      await tx
        .update(mealShareInvites)
        .set({ status: 'dismissed', respondedAt: now })
        .where(
          and(
            eq(mealShareInvites.sourceMealId, source.id),
            eq(mealShareInvites.status, 'pending'),
            notInArray(mealShareInvites.toUserId, recipientIds)
          )
        );
    }

    return { invitedCount: recipientIds.length, portionFactor, meal };
  });
}

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

  return await db.transaction(async (tx) => {
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

  const [updated] = await db
    .update(mealShareInvites)
    .set({ status: 'dismissed', respondedAt: new Date() })
    .where(
      and(
        eq(mealShareInvites.id, parsed.inviteId),
        eq(mealShareInvites.toUserId, user.id),
        eq(mealShareInvites.status, 'pending')
      )
    )
    .returning({ id: mealShareInvites.id });
  if (!updated) {
    throw Errors.notFound('Lời mời không tồn tại hoặc đã được xử lý.');
  }
  return { success: true };
}
