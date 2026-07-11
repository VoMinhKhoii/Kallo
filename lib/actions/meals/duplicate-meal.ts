'use server';

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
} from '@/lib/actions/persisted-meal';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { mealItems, mealShares, meals } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';
import type { ConfirmMealResponse } from './types';

// ---------------------------------------------------------------------------
// C4b: Duplicate a persisted meal ("log again")
// ---------------------------------------------------------------------------

const duplicateMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
  // Client-generated id so the optimistic card and the persisted row share a
  // stable React key (mirrors confirm/manual save).
  newMealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/**
 * "Log again": reproduce an existing meal exactly by copying its stored item
 * rows (composition ids, grams, per-row nutrition) into a brand-new meal
 * stamped for the chosen day. No AI pipeline runs, so the accepted numbers — and
 * any prior manual gram edits — are preserved verbatim instead of being
 * re-estimated from the raw text (which is what re-submitting the text would do).
 *
 * Tenant isolation: the source meal is loaded scoped to the authenticated user;
 * its item rows are reached only through that meal's id — mirroring
 * `updateMealAction`'s guard.
 */
export async function duplicateMealAction(input: {
  mealId: string;
  newMealId?: string;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<ConfirmMealResponse> {
  const parsed = duplicateMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1);

    if (!source) {
      throw Errors.validationFailed(
        'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
      );
    }
    // Cheat meals carry no item rows (their nutrition lives in the slider spec);
    // duplicating one as a precise meal would drop that, so refuse here.
    if (source.entryMode === 'cheat') {
      throw Errors.validationFailed('Không thể ghi lại bữa xả theo cách này.');
    }

    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));

    // A re-log is a new eating event "now" on the chosen day, so the slot is
    // inferred from the new instant rather than copied from the original.
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
        ...nutritionValuesToRow(mealNutrition),
      })
      .returning({ id: meals.id });

    // Share to circle by default: a re-log is a brand-new eating event, so it
    // shares automatically just like a fresh log (the AFTER INSERT trigger fans
    // out the meal_shared circle event). The new meal id never collides, so this
    // always inserts; the user can still opt this copy back out via the toggle.
    const [shareRow] = await tx
      .insert(mealShares)
      .values({ mealId: meal.id, actorId: user.id, visibility: 'circle' })
      .onConflictDoNothing({ target: mealShares.mealId })
      .returning({ id: mealShares.id, visibility: mealShares.visibility });
    const share = shareRow
      ? { shareId: shareRow.id, visibility: shareRow.visibility }
      : null;

    // Copy each item with a fresh id, preserving order/composition/grams and the
    // stored per-row nutrition exactly (extract → write the same values back).
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

    // Rebuild the saved meal in loadMealsByDate's shape, grouped by dish, so the
    // client reconciles its optimistic card in place (same id, no day refetch).
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
      // Shared to circle by default (see the meal_shares insert above).
      share,
    });

    return { mealId: meal.id, meal: savedMeal };
  });
}
