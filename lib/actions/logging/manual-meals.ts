'use server';

import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import {
  buildPersistedIngredient,
  buildPersistedMeal,
  buildPersistedMealItemGroup,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
} from '@/lib/actions/logging/persisted-meal';
import { insertDefaultCircleShare } from '@/lib/actions/meals/insert-default-share';
import type { ConfirmMealResponse } from '@/lib/actions/meals/types';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/assemble/goal-adjustment';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import {
  type SaveManualMealInput,
  saveManualMealSchema,
} from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import { scaleNutritionValues } from '@/lib/domain/logging/manual-logging';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db';
import {
  mealItems,
  meals,
  vietnameseFoodComposition,
} from '@/lib/infra/db/schema';

// Only the columns the save needs — the composition table also carries the
// 768-dim embedding (~15-20KB serialized) and search-text blobs, which
// SELECT * would ship per ingredient for nothing.
const compositionSelection = {
  id: vietnameseFoodComposition.id,
  namePrimary: vietnameseFoodComposition.namePrimary,
  ...(Object.fromEntries(
    NUTRITION_KEYS.map((key) => [key, vietnameseFoodComposition[key]])
  ) as {
    [K in (typeof NUTRITION_KEYS)[number]]: (typeof vietnameseFoodComposition)[K];
  }),
};

/**
 * Save a manually-composed meal: ingredient ids + grams in, nutrition computed
 * exactly from per-100g composition data — no AI pipeline, no pendingAnalyses
 * staging. Values are deterministic flat numbers, so goal adjustment is
 * skipped: goalAdjust on a flat low=mid=high triple returns mid, a no-op.
 *
 * Returns the same `{ mealId, meal }` shape as confirmAndSaveMealAction so the
 * client reconciles its optimistic card identically.
 */
export async function saveManualMealAction(
  input: SaveManualMealInput
): Promise<ConfirmMealResponse> {
  const parsed = saveManualMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  const ids = parsed.items.map((item) => item.foodCompositionId);
  const compositionRows = await db
    .select(compositionSelection)
    .from(vietnameseFoodComposition)
    .where(inArray(vietnameseFoodComposition.id, ids));
  const compositionById = new Map(compositionRows.map((row) => [row.id, row]));

  const missing = ids.filter((id) => !compositionById.has(id));
  if (missing.length > 0) {
    throw Errors.validationFailed(
      'Một hoặc nhiều nguyên liệu không tồn tại trong cơ sở dữ liệu.'
    );
  }

  // Pre-generate ingredient row ids so the inserted rows and the returned
  // payload share ids by construction (same pattern as confirm).
  const items = parsed.items.map((item, order) => {
    const composition = compositionById.get(item.foodCompositionId)!;
    return {
      id: randomUUID(),
      order,
      foodCompositionId: item.foodCompositionId,
      grams: item.grams,
      // Save the user's raw typed text as the label; the composition row still
      // drives the nutrition. Fall back to its name when no label was sent.
      name: item.label ?? composition.namePrimary,
      nutrition: scaleNutritionValues(
        extractNutritionValues(composition),
        item.grams
      ),
    };
  });

  const mealNutrition = sumDisplayedNutrition(items.map((i) => i.nutrition));
  const loggedAt = getUtcInstantForLocalDate(
    parsed.loggedDate,
    parsed.timezoneOffset
  );
  const mealSlot = parsed.mealSlot ?? inferMealSlot(loggedAt);
  const rawInput = items
    .map((item) => `${item.grams}g ${item.name}`)
    .join(', ');

  const { mealId, share } = await db.transaction(async (tx) => {
    const [meal] = await tx
      .insert(meals)
      .values({
        ...(parsed.mealId ? { id: parsed.mealId } : {}),
        userId: user.id,
        rawInput,
        mealSlot,
        // User-entered exact grams from verified DB entries — no estimation.
        confidenceOverall: 'high',
        loggedAt,
        entryMode: 'precise',
        ...nutritionValuesToRow(mealNutrition),
      })
      .returning({ id: meals.id });

    await tx.insert(mealItems).values(
      items.map((item) => ({
        id: item.id,
        mealId: meal.id,
        ingredientName: item.name,
        mealItemName: item.name,
        mealItemOrder: item.order,
        foodCompositionId: item.foodCompositionId,
        estimatedGrams: item.grams,
        userFacingUnit: 'g',
        cookingMethod: null,
        matchConfidence: 1,
        ...nutritionValuesToRow(item.nutrition),
      }))
    );

    // Share to circle by default unless the profile-level opt-out is set (the
    // AFTER INSERT trigger fans out the meal_shared circle event). The user
    // can still opt this meal back out via the per-meal toggle, while
    // onConflictDoNothing preserves a prior explicit choice on the
    // re-confirm/edit path (existing meal id).
    const share = await insertDefaultCircleShare(tx, {
      mealId: meal.id,
      actorId: user.id,
    });

    return { mealId: meal.id, share };
  });

  // One group per ingredient — a manual meal is a flat Cronometer-style list,
  // not AI-decomposed dishes. Group nutrition auto-sums in the builder,
  // guaranteeing parity with loadMealsByDate reconstruction.
  const mealItemGroups = items.map((item) =>
    buildPersistedMealItemGroup(item.name, item.order, [
      buildPersistedIngredient({
        id: item.id,
        ingredientName: item.name,
        foodCompositionId: item.foodCompositionId,
        estimatedGrams: item.grams,
        userFacingUnit: 'g',
        cookingMethod: null,
        matchConfidence: 1,
        nutrition: item.nutrition,
      }),
    ])
  );

  const savedMeal = buildPersistedMeal({
    id: mealId,
    rawInput,
    mealSlot,
    confidenceOverall: 'high',
    loggedAt: loggedAt.toISOString(),
    nutrition: mealNutrition,
    mealItemGroups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    // Shared to circle by default (see the meal_shares insert above).
    share,
  });

  return { mealId, meal: savedMeal };
}
