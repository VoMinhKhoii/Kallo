/**
 * The DB-anchored macro base: a matched ingredient's per-100g row scaled to
 * the grams the user actually ate.
 *
 * This is the one place that decides WHICH grams a DB row is scaled against —
 * the cooked→raw yield question — so `computeMacroBaseMap` (macros) and
 * `assemble.ts` (the 24 micronutrients) cannot drift apart.
 */

import { convertCookedToRaw } from '@/lib/ai/constants';
import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import { ingredientGrams } from '@/lib/ai/pipeline/contracts/ingredient-accessors';
import type {
  MacroBase,
  MatchedIngredient,
  NutritionPer100g,
} from '@/lib/ai/types';

const ingredientCookingMethod = (
  mealItem: MealDecompositionWithIds['mealItems'][number],
  ing: MealDecompositionWithIds['mealItems'][number]['ingredients'][number]
): string | null => ing.cookingMethod ?? mealItem.cookingMethod ?? null;

/**
 * Compute the per-ingredient macro base map. For each matched ingredient,
 * `base = (per_100g × dbScalingGrams) / 100` using the same dbState-aware
 * `convertCookedToRaw` logic that `assembly.ts` applies to the 24 non-macro
 * nutrients. Unmatched ingredients are absent from the map.
 *
 * Keyed by run-scoped ingredientId; collision-safe across dishes that share
 * an ingredient display name (e.g. `nước dùng` in two dishes).
 *
 * `weightBasis === 'raw'` short-circuits the cooked→raw conversion: the user
 * already gave the pre-cooking mass, so grams scales 1:1 against the (raw)
 * DB row that the matcher was steered toward.
 */
export function computeMacroBaseMap(
  decomposition: MealDecompositionWithIds,
  matched: MatchedIngredient[]
): Map<string, MacroBase> {
  const matchedById = new Map<string, MatchedIngredient>();
  for (const m of matched) {
    if (m.ingredientId) matchedById.set(m.ingredientId, m);
  }

  const baseMap = new Map<string, MacroBase>();
  for (const mealItem of decomposition.mealItems) {
    for (const ing of mealItem.ingredients) {
      const id = ing.ingredientId;
      if (!id) continue;
      const match = matchedById.get(id);
      if (!match) continue;
      const grams = ingredientGrams(ing);
      const dbState = match.dbState ?? 'unknown';
      const cookingMethod = ingredientCookingMethod(mealItem, ing);
      const dbScalingGrams = computeDbScalingGrams({
        grams,
        dbState,
        cookingMethod,
        weightBasis: ing.weightBasis,
      });
      baseMap.set(id, scalePer100g(match.nutritionPer100g, dbScalingGrams));
    }
  }
  return baseMap;
}

/**
 * Resolve the grams used to scale a DB per-100g row against the user's
 * portion. Centralizes the cooked→raw conversion rule for both
 * `computeMacroBaseMap` (macros) and `assembly.ts` (24 micronutrients):
 *
 * 1. `weightBasis === 'raw'`: user gave pre-cooking mass → use `grams` as-is.
 *    The matcher is biased to raw rows via `deriveExpectedState`, so the
 *    1:1 scaling is the physically correct answer regardless of dish method.
 * 2. DB row is cooked: `grams` already reflects cooked mass → use as-is.
 * 3. DB row is raw (or unknown) and weight is as-eaten: convert cooked grams
 *    to raw equivalent via the cooking-method yield factor.
 */
export function computeDbScalingGrams(input: {
  grams: number;
  dbState: 'raw' | 'cooked' | 'unknown';
  cookingMethod: string | null;
  weightBasis: 'raw' | 'as_eaten' | undefined;
}): number {
  if (input.weightBasis === 'raw') return input.grams;
  if (input.dbState === 'cooked') return input.grams;
  return convertCookedToRaw(input.grams, input.cookingMethod);
}

export function scalePer100g(
  per100g: NutritionPer100g,
  grams: number
): MacroBase {
  return {
    caloriesKcal: (per100g.caloriesKcal ?? 0) * (grams / 100),
    proteinG: (per100g.proteinG ?? 0) * (grams / 100),
    carbohydrateG: (per100g.carbohydrateG ?? 0) * (grams / 100),
    fatG: (per100g.fatG ?? 0) * (grams / 100),
  };
}
