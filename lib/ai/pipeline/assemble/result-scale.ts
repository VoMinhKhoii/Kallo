/**
 * Arithmetic on a finished meal: scale or transform parts' nutrients, and carry
 * the change into dish and meal totals. Used by the steps that adjust a meal
 * after assembly (typed calories, the plain-read hold, seeing rescue).
 */
import {
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from '@/lib/ai/pipeline/assemble/goal-adjustment';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type {
  PipelineMealItem,
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';

/** `total` with `before` taken out and `after` put in, per nutrient. */
export function swapNutritionValues(
  total: NutritionValues,
  before: NutritionValues,
  after: NutritionValues
): NutritionValues {
  const out = { ...total };
  for (const key of Object.keys(out) as (keyof NutritionValues)[]) {
    const t = out[key];
    if (t != null) out[key] = t - (before[key] ?? 0) + (after[key] ?? 0);
  }
  return out;
}

export function swapBoundedNutrition(
  total: BoundedNutrition,
  before: BoundedNutrition,
  after: BoundedNutrition
): BoundedNutrition {
  const out = { ...total };
  for (const key of Object.keys(out) as (keyof BoundedNutrition)[]) {
    const t = out[key];
    if (t == null) continue;
    const b = before[key];
    const a = after[key];
    out[key] = {
      low: t.low - (b?.low ?? 0) + (a?.low ?? 0),
      mid: t.mid - (b?.mid ?? 0) + (a?.mid ?? 0),
      high: t.high - (b?.high ?? 0) + (a?.high ?? 0),
    };
  }
  return out;
}

/** `result` with one meal item replaced and the meal totals moved with it. */
export function replaceMealItem(
  result: PipelineResult,
  index: number,
  next: PipelineMealItem
): PipelineResult {
  const before = result.mealItems[index];
  return {
    ...result,
    mealItems: result.mealItems.map((mi, i) => (i === index ? next : mi)),
    boundedNutrition: swapBoundedNutrition(
      result.boundedNutrition,
      before.boundedNutrition,
      next.boundedNutrition
    ),
    displayedNutrition: swapNutritionValues(
      result.displayedNutrition,
      before.displayedNutrition,
      next.displayedNutrition
    ),
  };
}

export function scaleNutritionValues(
  v: NutritionValues,
  f: number
): NutritionValues {
  const out = { ...v };
  for (const key of Object.keys(out) as (keyof NutritionValues)[]) {
    const x = out[key];
    if (x != null) out[key] = x * f;
  }
  return out;
}

export function scaleBoundedNutrition(
  b: BoundedNutrition,
  f: number
): BoundedNutrition {
  const out = { ...b };
  for (const key of Object.keys(out) as (keyof BoundedNutrition)[]) {
    const e = out[key];
    if (e != null)
      out[key] = { low: e.low * f, mid: e.mid * f, high: e.high * f };
  }
  return out;
}

/**
 * Transform ingredients across all dishes in one pass and recompute changed
 * dish and meal totals directly via `sumBoundedNutrition` /
 * `sumDisplayedNutrition` (avoids O(n^2) rewrites, IEEE-754 subtraction
 * residue, and null-total skipping when a previously null nutrient becomes
 * non-null). Returns `result` unchanged by reference when no ingredient moves.
 */
export function mapIngredients(
  result: PipelineResult,
  fn: (ing: ProcessedIngredient, flatIndex: number) => ProcessedIngredient
): PipelineResult {
  let flatIndex = 0;
  let anyChanged = false;
  const mealItems = result.mealItems.map((mi) => {
    let dishChanged = false;
    const ingredients = mi.ingredients.map((ing) => {
      const next = fn(ing, flatIndex++);
      if (next !== ing) dishChanged = true;
      return next;
    });
    if (!dishChanged) return mi;
    anyChanged = true;
    return {
      ...mi,
      ingredients,
      boundedNutrition: sumBoundedNutrition(
        ingredients.map((i) => i.boundedNutrition)
      ),
      displayedNutrition: sumDisplayedNutrition(
        ingredients.map((i) => i.displayedNutrition)
      ),
    };
  });
  if (!anyChanged) return result;
  return {
    ...result,
    mealItems,
    boundedNutrition: sumBoundedNutrition(
      mealItems.map((mi) => mi.boundedNutrition)
    ),
    displayedNutrition: sumDisplayedNutrition(
      mealItems.map((mi) => mi.displayedNutrition)
    ),
  };
}
