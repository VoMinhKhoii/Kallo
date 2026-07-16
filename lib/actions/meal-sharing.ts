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
// the accept path performs the one deliberate cross-user meal read, authorized
// solely by a pending invite row addressed to the reader.

import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
  scaleNutritionRow,
} from '@/lib/actions/persisted-meal';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import {
  friendships,
  mealItems,
  mealShareInvites,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import {
  acceptMealShareInviteSchema,
  dismissMealShareInviteSchema,
  shareMealWithFriendsSchema,
} from '@/lib/validation';
import type { ConfirmMealResponse, PersistedMeal } from './meals/types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MealRow = typeof meals.$inferSelect;
type MealItemRow = typeof mealItems.$inferSelect;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface MealShareInvite {
  id: string;
  mode: 'copy' | 'split';
  /** Fraction of the original the recipient gets — for the "½ portion" label. */
  portionFactor: number;
  createdAt: string;
  from: {
    userId: string;
    handle: string;
    displayName: string | null;
    avatarSeed: string | null;
  };
  /** The portion the recipient will receive (already the sender's share for a
   *  split — the source meal was scaled down when it was shared). */
  meal: {
    rawInput: string;
    caloriesKcal: number | null;
    proteinG: number | null;
    carbohydrateG: number | null;
    fatG: number | null;
  };
}

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

    return { invitedCount: recipientIds.length, portionFactor, meal };
  });
}

/**
 * Scale the actor's own meal (item rows + totals + alcohol) in place by `factor`
 * and rebuild it in loadMealsByDate's shape so the card reconciles without a
 * refetch. Used only for a split, where the logger keeps their share of a shared
 * item. Mirrors updateMealAction's scaling, applied uniformly across every row.
 */
async function scaleOwnMealInPlace(
  tx: Tx,
  source: MealRow,
  itemRows: MealItemRow[],
  factor: number
): Promise<PersistedMeal> {
  const scaled = itemRows.map((row) => ({
    row,
    grams: row.estimatedGrams != null ? row.estimatedGrams * factor : null,
    nutrition: scaleNutritionRow(row, factor),
  }));

  for (const { row, grams, nutrition } of scaled) {
    await tx
      .update(mealItems)
      .set({ estimatedGrams: grams, ...nutritionValuesToRow(nutrition) })
      .where(and(eq(mealItems.id, row.id), eq(mealItems.mealId, source.id)));
  }

  const mealNutrition = scaleNutritionRow(source, factor);
  const newAlcoholG = source.alcoholG != null ? source.alcoholG * factor : null;

  await tx
    .update(meals)
    .set({
      ...nutritionValuesToRow(mealNutrition),
      alcoholG: newAlcoholG,
      portionFactor: factor,
    })
    .where(and(eq(meals.id, source.id), eq(meals.userId, source.userId)));

  const mealItemGroups = buildMealItemGroupsFromRows(
    scaled.map(({ row, grams, nutrition }) => ({
      ...row,
      estimatedGrams: grams,
      nutrition,
    }))
  );

  // Carry the existing share row through so the card keeps its shared state.
  const [shareRow] = await tx
    .select({ id: mealShares.id, visibility: mealShares.visibility })
    .from(mealShares)
    .where(eq(mealShares.mealId, source.id))
    .limit(1);

  return buildPersistedMeal({
    id: source.id,
    rawInput: source.rawInput,
    mealSlot: source.mealSlot,
    confidenceOverall: source.confidenceOverall,
    loggedAt: source.loggedAt.toISOString(),
    nutrition: mealNutrition,
    mealItemGroups,
    entryMode: 'precise',
    alcoholG: newAlcoholG,
    cheatSliders: null,
    share: shareRow
      ? { shareId: shareRow.id, visibility: shareRow.visibility }
      : null,
    portionFactor: factor,
  });
}

// ---------------------------------------------------------------------------
// S2: List my pending invites (the Circle inbox)
// ---------------------------------------------------------------------------

export async function listMealShareInvitesAction(): Promise<MealShareInvite[]> {
  const { user } = await requireAuthAndProfile();

  const rows = await db
    .select({
      id: mealShareInvites.id,
      mode: mealShareInvites.mode,
      portionFactor: mealShareInvites.portionFactor,
      createdAt: mealShareInvites.createdAt,
      fromUserId: mealShareInvites.fromUserId,
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(mealShareInvites)
    // The userId join is defense-in-depth: invites are only ever created by
    // the meal's owner, but nothing in the schema proves from_user_id owns
    // source_meal_id — keep the invariant enforced at read time too.
    .innerJoin(
      meals,
      and(
        eq(meals.id, mealShareInvites.sourceMealId),
        eq(meals.userId, mealShareInvites.fromUserId)
      )
    )
    .innerJoin(
      publicProfiles,
      eq(publicProfiles.userId, mealShareInvites.fromUserId)
    )
    // Only surface invites from someone still an accepted friend — unfriending
    // or blocking the sender must drop their offer from the inbox, not leave it
    // acceptable indefinitely.
    .innerJoin(
      friendships,
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.userLow, user.id),
            eq(friendships.userHigh, mealShareInvites.fromUserId)
          ),
          and(
            eq(friendships.userHigh, user.id),
            eq(friendships.userLow, mealShareInvites.fromUserId)
          )
        )
      )
    )
    .where(
      and(
        eq(mealShareInvites.toUserId, user.id),
        eq(mealShareInvites.status, 'pending')
      )
    )
    .orderBy(desc(mealShareInvites.createdAt));

  return rows.map((r) => ({
    id: r.id,
    mode: r.mode === 'split' ? 'split' : 'copy',
    portionFactor: Number(r.portionFactor) || 1,
    createdAt: r.createdAt.toISOString(),
    from: {
      userId: r.fromUserId,
      handle: r.handle,
      displayName: r.displayName,
      avatarSeed: r.avatarSeed,
    },
    // Macros are the source meal's CURRENT values — already the recipient's
    // share for a split (the sender's meal was scaled down when shared).
    meal: {
      rawInput: r.rawInput,
      caloriesKcal: r.caloriesKcal,
      proteinG: r.proteinG,
      carbohydrateG: r.carbohydrateG,
      fatG: r.fatG,
    },
  }));
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
    // Atomically CLAIM the invite: flip pending -> accepted in one guarded
    // UPDATE. A concurrent accept (two devices, a double-tap) loses the race —
    // zero rows returned — and is rejected, so the meal is never materialized
    // twice. The status flip rolls back with the tx if anything below throws.
    const [invite] = await tx
      .update(mealShareInvites)
      .set({ status: 'accepted', respondedAt: new Date() })
      .where(
        and(
          eq(mealShareInvites.id, parsed.inviteId),
          eq(mealShareInvites.toUserId, user.id),
          eq(mealShareInvites.status, 'pending')
        )
      )
      .returning({
        sourceMealId: mealShareInvites.sourceMealId,
        fromUserId: mealShareInvites.fromUserId,
      });
    if (!invite) {
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

    // Authorized cross-user read: the source meal belongs to the SENDER. The
    // invite I just claimed is what permits this single read. The userId
    // predicate re-proves the sender owns the meal (defense-in-depth — no
    // schema constraint ties from_user_id to source_meal_id's owner).
    const [source] = await tx
      .select()
      .from(meals)
      .where(
        and(
          eq(meals.id, invite.sourceMealId),
          eq(meals.userId, invite.fromUserId)
        )
      )
      .limit(1);
    if (!source) {
      throw Errors.notFound('Bữa ăn không còn tồn tại.');
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
    const mealSlot = inferMealSlot(loggedAt);
    const mealNutrition = extractNutritionValues(source);

    const [meal] = await tx
      .insert(meals)
      .values({
        ...(parsed.newMealId ? { id: parsed.newMealId } : {}),
        userId: user.id,
        rawInput: source.rawInput,
        mealSlot,
        confidenceOverall: source.confidenceOverall,
        loggedAt,
        entryMode: 'precise',
        alcoholG: source.alcoholG,
        // The copy represents the same fraction of the natural full portion the
        // source does — already the sender's share for a split.
        portionFactor: source.portionFactor,
        ...nutritionValuesToRow(mealNutrition),
      })
      .returning({ id: meals.id });

    // Share the accepted copy to my own circle by default, exactly like any
    // freshly logged meal (the AFTER INSERT trigger fans out the event).
    const [shareRow] = await tx
      .insert(mealShares)
      .values({ mealId: meal.id, actorId: user.id, visibility: 'circle' })
      .onConflictDoNothing({ target: mealShares.mealId })
      .returning({ id: mealShares.id, visibility: mealShares.visibility });
    const share = shareRow
      ? { shareId: shareRow.id, visibility: shareRow.visibility }
      : null;

    // Copy each item verbatim with a fresh id (no re-scaling — a split's share
    // is already baked into the source meal's stored values).
    const copies = sourceItems.map((row) => ({
      id: randomUUID(),
      row,
      nutrition: extractNutritionValues(row),
    }));
    if (copies.length > 0) {
      await tx.insert(mealItems).values(
        copies.map(({ id, row, nutrition }) => ({
          id,
          mealId: meal.id,
          ingredientName: row.ingredientName,
          mealItemName: row.mealItemName,
          mealItemOrder: row.mealItemOrder,
          foodCompositionId: row.foodCompositionId,
          estimatedGrams: row.estimatedGrams,
          userFacingUnit: row.userFacingUnit,
          cookingMethod: row.cookingMethod,
          matchConfidence: row.matchConfidence,
          ...nutritionValuesToRow(nutrition),
        }))
      );
    }

    // Point the already-claimed invite at the materialized meal.
    await tx
      .update(mealShareInvites)
      .set({ acceptedMealId: meal.id })
      .where(eq(mealShareInvites.id, parsed.inviteId));

    const mealItemGroups = buildMealItemGroupsFromRows(
      copies.map(({ id, row, nutrition }) => ({ ...row, id, nutrition }))
    );

    const savedMeal = buildPersistedMeal({
      id: meal.id,
      rawInput: source.rawInput,
      mealSlot,
      confidenceOverall: source.confidenceOverall,
      loggedAt: loggedAt.toISOString(),
      nutrition: mealNutrition,
      mealItemGroups,
      entryMode: 'precise',
      alcoholG: source.alcoholG ?? null,
      cheatSliders: null,
      share,
      portionFactor: source.portionFactor,
    });

    return { mealId: meal.id, meal: savedMeal };
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
