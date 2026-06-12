'use server';

import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import type { ConfirmMealResponse } from '@/lib/actions/meals';
import {
  buildPersistedIngredient,
  buildPersistedMeal,
  buildPersistedMealItemGroup,
} from '@/lib/actions/persisted-meal';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import type { NutritionValues } from '@/lib/ai/types';
import {
  type SaveManualMealInput,
  saveManualMealSchema,
} from '@/lib/api/contracts/meals';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { mealItems, meals, vietnameseFoodComposition } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { scaleNutritionValues } from '@/lib/logging/manual-logging';

/** Infer meal slot from time of day (mirrors lib/actions/meals.ts). */
function inferMealSlot(date: Date): string {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

/** Persist a single numeric value per nutrient on meals and meal_items. */
function nutritionValuesToRow(
  nutrition: NutritionValues
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of NUTRITION_KEYS) {
    row[key] = nutrition[key];
  }
  return row;
}

/** Parse a composition row's per-100g values — its numeric columns surface as
 *  strings (they are declared without `mode: 'number'`). */
function parsePer100g(row: Record<string, unknown>): NutritionValues {
  const result = {} as Record<string, number | null>;
  for (const key of NUTRITION_KEYS) {
    const raw = row[key];
    const parsed = raw == null ? null : Number(raw);
    result[key] = parsed != null && Number.isFinite(parsed) ? parsed : null;
  }
  return result as unknown as NutritionValues;
}

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
    .select()
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
      name: composition.namePrimary,
      nutrition: scaleNutritionValues(
        parsePer100g(composition as Record<string, unknown>),
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

  const mealId = await db.transaction(async (tx) => {
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

    return meal.id;
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
    share: null,
  });

  return { mealId, meal: savedMeal };
}
