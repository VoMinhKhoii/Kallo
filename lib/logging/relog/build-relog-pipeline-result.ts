// Turn relogged dishes (copied `meal_items` rows) into a `PipelineResult` so
// they can ride the SAME staged-analysis → editable review → confirm path that
// AI meals use, instead of writing straight to the DB.
//
// The one trick that makes this safe: confirm (`confirmAndSaveMealAction`)
// re-runs `goalAdjustNutrition` on every ingredient's `boundedNutrition` at
// confirm time. But relogged rows store only FINAL goal-adjusted macros with no
// goal/aggression snapshot — their numbers can only be copied, never
// re-derived. So each frozen ingredient carries a DEGENERATE bounded triple
// `{low:v, mid:v, high:v}`: `goalAdjust` then returns `v` for any goal or
// aggression (`goal-adjustment.ts` — with `low === mid === high`, the goal
// bound equals mid, so `mid + a*(bound - mid) === mid`), making confirm's
// re-adjustment a mathematical no-op. A later gram edit scales low/mid/high by
// one ratio, so the triple stays degenerate and still adjusts to the scaled
// value. This module is pure data-shape mapping — no server/browser imports.

import { extractNutritionValues } from '@/lib/actions/logging/persisted-meal';
import type {
  ResolvedDish,
  SourceItemRow,
} from '@/lib/actions/meals/relog/expand-refs';
import {
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from '@/lib/ai/pipeline/assemble/goal-adjustment';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type {
  MealConfidence,
  PipelineMealItem,
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';
import { weakestConfidence } from '@/lib/logging/relog/relog';

/** The `meal_items` columns a frozen relog item needs, on top of the grouping
 *  fields `resolveRelogDishes` already keys on. The nutrient columns are read
 *  positionally by `extractNutritionValues`, so they don't appear here. */
export interface RelogSourceRow extends SourceItemRow {
  ingredientName: string;
  foodCompositionId: string | null;
  estimatedGrams: number | null;
  userFacingUnit: string | null;
  cookingMethod: string | null;
  matchConfidence: number | null;
}

const CONFIDENCE_VALUES: readonly MealConfidence[] = ['high', 'medium', 'low'];

/** Map the weakest-confidence string to a `MealConfidence`. Defaults to 'low'
 *  (never upgrade): an unrecognized or all-null source must not read as 'high'. */
function toMealConfidence(value: string | null): MealConfidence {
  return (CONFIDENCE_VALUES as readonly string[]).includes(value ?? '')
    ? (value as MealConfidence)
    : 'low';
}

/** A degenerate bounded triple per nutrient: `{low:v, mid:v, high:v}`, or null
 *  where the stored value is null. This is what neutralizes confirm's
 *  goal-adjustment (see the file header). */
export function toDegenerateBounded(values: NutritionValues): BoundedNutrition {
  const result = {} as Record<
    string,
    { low: number; mid: number; high: number } | null
  >;
  for (const key of NUTRITION_KEYS) {
    const v = values[key];
    result[key] = v == null ? null : { low: v, mid: v, high: v };
  }
  return result as unknown as BoundedNutrition;
}

/** Coerce a stored gram value to the non-null number `ProcessedIngredient`
 *  requires; a null column (rare) becomes 0. */
function toGrams(value: number | null): number {
  return value != null && Number.isFinite(value) ? value : 0;
}

/** Build one frozen `PipelineMealItem` from a resolved dish, copying each
 *  ingredient row verbatim into a `ProcessedIngredient` with a degenerate
 *  bounded triple. */
export function buildFrozenMealItem<T extends RelogSourceRow>(
  dish: ResolvedDish<T>
): PipelineMealItem {
  const ingredients: ProcessedIngredient[] = dish.rows.map((row) => {
    const displayed = extractNutritionValues(row as Record<string, unknown>);
    const grams = toGrams(row.estimatedGrams);
    return {
      ingredientName: row.ingredientName,
      foodCompositionId: row.foodCompositionId,
      estimatedGrams: grams,
      // Internal DB-scaling grams only; confirm never reads it. Mirror
      // estimatedGrams so nothing downstream sees a zero.
      rawEquivalentGrams: grams,
      cookingMethod: row.cookingMethod,
      userFacingUnit: row.userFacingUnit,
      matchConfidence: row.matchConfidence,
      boundedNutrition: toDegenerateBounded(displayed),
      displayedNutrition: displayed,
    };
  });

  return {
    name: dish.name,
    ingredients,
    boundedNutrition: sumBoundedNutrition(
      ingredients.map((ing) => ing.boundedNutrition)
    ),
    displayedNutrition: sumDisplayedNutrition(
      ingredients.map((ing) => ing.displayedNutrition)
    ),
  };
}

/**
 * Build a full frozen `PipelineResult` for a PURE relog (no AI portion).
 *
 * Dishes are kept in staged order; confirm uses each item's array index as its
 * `mealItemOrder`, so two picks of the same dish stay distinct groups (no
 * silent halving). Meal nutrition is SUMMED from the frozen items — never a
 * source meal's stored total. `mealSlot: null` lets confirm infer the slot from
 * the new instant, and confidence is the weakest across contributing sources.
 */
export function buildRelogPipelineResult<T extends RelogSourceRow>(
  dishes: ResolvedDish<T>[],
  sourceConfidences: (string | null)[]
): PipelineResult {
  const mealItems = dishes.map((dish) => buildFrozenMealItem(dish));
  return {
    mealItems,
    mealSlot: null,
    confidenceOverall: toMealConfidence(weakestConfidence(sourceConfidences)),
    boundedNutrition: sumBoundedNutrition(
      mealItems.map((item) => item.boundedNutrition)
    ),
    displayedNutrition: sumDisplayedNutrition(
      mealItems.map((item) => item.displayedNutrition)
    ),
    unmatchedIngredients: [],
  };
}

/**
 * Merge frozen relog items into an AI pipeline result for the COMBINED case.
 *
 * Relog items are appended AFTER the AI items (positional order = confirm's
 * `mealItemOrder`). Meal totals are recomputed across all items, and confidence
 * drops to the weakest of the AI portion and every relog source — a meal is no
 * more confident than its least confident part. The AI's `unmatchedIngredients`
 * carry through unchanged (relog adds none). Callers must NOT pass relog refs
 * into the pipeline itself: the AI only ever sees the free text.
 */
export function mergeRelogIntoPipelineResult(
  aiResult: PipelineResult,
  relogItems: PipelineMealItem[],
  relogConfidence: MealConfidence
): PipelineResult {
  const mealItems = [...aiResult.mealItems, ...relogItems];
  return {
    mealItems,
    mealSlot: aiResult.mealSlot,
    confidenceOverall: toMealConfidence(
      weakestConfidence([aiResult.confidenceOverall, relogConfidence])
    ),
    boundedNutrition: sumBoundedNutrition(
      mealItems.map((item) => item.boundedNutrition)
    ),
    displayedNutrition: sumDisplayedNutrition(
      mealItems.map((item) => item.displayedNutrition)
    ),
    unmatchedIngredients: aiResult.unmatchedIngredients,
  };
}
