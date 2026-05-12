import { convertCookedToRaw } from '../constants';
import type {
  BoundedEstimate,
  IngredientLlmNutrition,
  MacroBase,
  MatchedIngredient,
  MealItemNutrition,
  NutritionAdjustment,
  NutritionPer100g,
} from '../types';
import type { MealDecompositionWithIds } from './ids';
import { ingredientDisplayName, ingredientGrams } from './ingredient-accessors';

/**
 * Raw shape that comes out of `nutritionAdjustmentSchema.parse()` before
 * reconciliation: `ingredientId` / `mealItemId` are optional (today's prompt
 * does not request them). Macros are absolute `{low, mid, high}` triples.
 */
export type RawNutritionAdjustment = {
  mealItems: Array<{
    mealItemId?: string;
    mealItemName: string;
    ingredients: Array<{
      ingredientId?: string;
      ingredientName: string;
      caloriesKcal: BoundedEstimate;
      proteinG: BoundedEstimate;
      carbohydrateG: BoundedEstimate;
      fatG: BoundedEstimate;
    }>;
  }>;
};

const MACRO_KEYS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
] as const;

/**
 * If the LLM `mid` deviates from `base` by more than this multiplicative
 * factor (or its inverse), treat it as a hallucination and snap to base.
 * Realistic cooking adjustments stay well within 1.5–2× (frying-in-oil
 * roughly doubles fat at most). The 2026-05-12 sườn non case had `mid` =
 * 5511 vs base ≈ 270 — a 20× deviation, two orders of magnitude beyond
 * any plausible cooking factor.
 */
const HALLUCINATION_GUARD_RATIO = 3;

const ingredientCookingMethod = (
  mealItem: MealDecompositionWithIds['mealItems'][number],
  ing: MealDecompositionWithIds['mealItems'][number]['ingredients'][number]
): string | null => mealItem.cookingMethod ?? ing.cookingMethod ?? null;

/**
 * Compute the per-ingredient macro base map. For each matched ingredient,
 * `base = (per_100g × dbScalingGrams) / 100` using the same dbState-aware
 * `convertCookedToRaw` logic that `assembly.ts` applies to the 24 non-macro
 * nutrients. Unmatched ingredients are absent from the map.
 *
 * Keyed by run-scoped ingredientId; collision-safe across dishes that share
 * an ingredient display name (e.g. `nước dùng` in two dishes).
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
      const dbScalingGrams =
        dbState === 'cooked'
          ? grams
          : convertCookedToRaw(grams, cookingMethod);
      baseMap.set(id, scalePer100g(match.nutritionPer100g, dbScalingGrams));
    }
  }
  return baseMap;
}

function scalePer100g(
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

/**
 * Apply the hallucination guard: keep the LLM's mid only if it's within
 * `HALLUCINATION_GUARD_RATIO`× of `base` (in either direction). Otherwise
 * snap mid back to `base` and log so we can monitor how often it fires.
 *
 * `low` and `high` are also kept in range so the triple stays ordered after
 * any snap (`low ≤ mid ≤ high`). This is the load-bearing fix for the
 * 2026-05-12 regression — at most a 3× deviation is permitted; the original
 * 5511 vs 270 (20×) was two orders of magnitude beyond that.
 */
function guardMacro(
  raw: BoundedEstimate,
  base: number,
  ingredientName: string,
  macroName: string
): BoundedEstimate {
  if (base <= 0) {
    // Base is 0 (e.g., pepper has no kcal). Trust the LLM since the guard
    // ratio is undefined — but downstream density clamps still apply.
    return raw;
  }
  const ratio = raw.mid / base;
  const overshoot = ratio > HALLUCINATION_GUARD_RATIO;
  const undershoot = ratio < 1 / HALLUCINATION_GUARD_RATIO;
  if (!overshoot && !undershoot) {
    // LLM mid is in plausible cooking-adjusted range; trust it as-is.
    return raw;
  }
  console.warn(
    `[nutrition] hallucination_guard: snapped ${macroName} of "${ingredientName}" from mid=${raw.mid.toFixed(1)} to base=${base.toFixed(1)} (ratio ${ratio.toFixed(2)}× vs ${HALLUCINATION_GUARD_RATIO}× threshold)`
  );
  // Snap mid to base; rebuild low/high so the triple is ordered. We preserve
  // the LLM's *relative* spread by re-anchoring around base.
  const spread = raw.high - raw.low;
  const halfSpread = Math.max(spread / 2, base * 0.05);
  return {
    low: Math.max(0, base - halfSpread),
    mid: base,
    high: base + halfSpread,
  };
}

/**
 * Resolve a single raw ingredient's macros against the precomputed base map.
 * For matched ingredients, the LLM is the source of truth for cooking
 * adjustments (frying-in-oil raises fat, rice absorbs water, etc.); the
 * guard only fires if `mid` deviates from `base` beyond physical plausibility.
 * For unmatched ingredients (no base), the LLM triple is kept; density
 * clamping happens in `validateNutritionOutput`.
 */
function resolveIngredientMacros(
  rawIng: RawNutritionAdjustment['mealItems'][number]['ingredients'][number],
  base: MacroBase | undefined
): {
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
} {
  if (!base) {
    return {
      caloriesKcal: rawIng.caloriesKcal,
      proteinG: rawIng.proteinG,
      carbohydrateG: rawIng.carbohydrateG,
      fatG: rawIng.fatG,
    };
  }
  return {
    caloriesKcal: guardMacro(
      rawIng.caloriesKcal,
      base.caloriesKcal,
      rawIng.ingredientName,
      'caloriesKcal'
    ),
    proteinG: guardMacro(
      rawIng.proteinG,
      base.proteinG,
      rawIng.ingredientName,
      'proteinG'
    ),
    carbohydrateG: guardMacro(
      rawIng.carbohydrateG,
      base.carbohydrateG,
      rawIng.ingredientName,
      'carbohydrateG'
    ),
    fatG: guardMacro(rawIng.fatG, base.fatG, rawIng.ingredientName, 'fatG'),
  };
}

/**
 * Public helper for the streaming path: resolve a single raw meal item to
 * the bounded shape downstream consumers expect, applying the hallucination
 * guard per matched ingredient. Match raw → decomposed by ingredient name
 * within the meal item (first-match-on-collision).
 */
export function resolveStreamingMealItem(
  rawItem: RawNutritionAdjustment['mealItems'][number],
  decomposedMealItem:
    | MealDecompositionWithIds['mealItems'][number]
    | undefined,
  baseMap: Map<string, MacroBase>
): MealItemNutrition {
  const ingredients: IngredientLlmNutrition[] = rawItem.ingredients.map(
    (rawIng) => {
      const decIng = decomposedMealItem?.ingredients.find(
        (ing) => ingredientDisplayName(ing) === rawIng.ingredientName
      );
      const ingredientId = decIng?.ingredientId ?? '';
      const base = ingredientId ? baseMap.get(ingredientId) : undefined;
      const resolved = resolveIngredientMacros(rawIng, base);
      return {
        ingredientId,
        ingredientName: rawIng.ingredientName,
        ...resolved,
      };
    }
  );

  return {
    mealItemId: decomposedMealItem?.mealItemId,
    mealItemName: rawItem.mealItemName,
    ingredients,
  };
}

/**
 * Reconcile Call 2 nutrition output with the run-scoped ids assigned by
 * `ensureIdsOnDecomposition`, applying the hallucination guard in the same
 * pass.
 *
 * Strategy:
 *   1. Match meal items by name (FIFO queue for duplicate display names).
 *   2. Match ingredients by name within the meal item (same FIFO policy).
 *   3. For each matched ingredient with a DB-anchored base: keep the LLM's
 *      mid if it's within `HALLUCINATION_GUARD_RATIO`× of base (so cooking
 *      adjustments survive); otherwise snap mid to base.
 *   4. For unmatched ingredients: keep the LLM triple; physical-density
 *      clamping happens in `validateNutritionOutput`.
 */
export function reconcileNutritionIds(
  raw: RawNutritionAdjustment,
  decomposition: MealDecompositionWithIds,
  matched: MatchedIngredient[]
): NutritionAdjustment {
  const baseMap = computeMacroBaseMap(decomposition, matched);

  const mealItemQueueByName = new Map<
    string,
    MealDecompositionWithIds['mealItems']
  >();
  for (const mi of decomposition.mealItems) {
    const list = mealItemQueueByName.get(mi.name) ?? [];
    list.push(mi);
    mealItemQueueByName.set(mi.name, list);
  }
  const mealItemConsumed = new Map<string, number>();

  const reconciledMealItems: MealItemNutrition[] = raw.mealItems.map(
    (rawMi) => {
      const queue = mealItemQueueByName.get(rawMi.mealItemName) ?? [];
      const consumed = mealItemConsumed.get(rawMi.mealItemName) ?? 0;
      const decomposedMi = queue[consumed] ?? queue[queue.length - 1];
      if (!decomposedMi) {
        throw new Error(
          `[reconcile] Call 2 returned meal item "${rawMi.mealItemName}" not present in decomposition`
        );
      }
      mealItemConsumed.set(rawMi.mealItemName, consumed + 1);
      const totalForName = queue.length;
      if (totalForName > 1 && consumed >= totalForName) {
        console.warn(
          `[reconcile] meal item name collision: "${rawMi.mealItemName}" appears ${totalForName}x; Call 2 returned more entries than decomposition — wrapping to last slot`,
          { mealItemId: decomposedMi.mealItemId }
        );
      }

      const ingredientQueueByName = new Map<
        string,
        (typeof decomposedMi.ingredients)[number][]
      >();
      for (const ing of decomposedMi.ingredients) {
        const name = ingredientDisplayName(ing);
        const list = ingredientQueueByName.get(name) ?? [];
        list.push(ing);
        ingredientQueueByName.set(name, list);
      }
      const ingredientConsumed = new Map<string, number>();

      const ingredients: IngredientLlmNutrition[] = rawMi.ingredients.map(
        (rawIng) => {
          const ingQueue =
            ingredientQueueByName.get(rawIng.ingredientName) ?? [];
          const ingConsumed =
            ingredientConsumed.get(rawIng.ingredientName) ?? 0;
          const decomposedIng =
            ingQueue[ingConsumed] ?? ingQueue[ingQueue.length - 1];
          if (!decomposedIng) {
            throw new Error(
              `[reconcile] Call 2 returned ingredient "${rawIng.ingredientName}" not present in meal item "${rawMi.mealItemName}"`
            );
          }
          ingredientConsumed.set(rawIng.ingredientName, ingConsumed + 1);
          const totalForIngName = ingQueue.length;
          if (totalForIngName > 1 && ingConsumed >= totalForIngName) {
            console.warn(
              `[reconcile] ingredient name collision: "${rawIng.ingredientName}" appears ${totalForIngName}x in "${rawMi.mealItemName}" — wrapping to last slot`,
              {
                ingredientId: decomposedIng.ingredientId,
                mealItemId: decomposedMi.mealItemId,
                matchedSimilarity: matched.find(
                  (m) => m.ingredientId === decomposedIng.ingredientId
                )?.similarity,
              }
            );
          }
          const ingredientId = decomposedIng.ingredientId;
          const base = baseMap.get(ingredientId);
          const resolved = resolveIngredientMacros(rawIng, base);
          return {
            ingredientId,
            ingredientName: rawIng.ingredientName,
            ...resolved,
          };
        }
      );

      return {
        mealItemId: decomposedMi.mealItemId,
        mealItemName: rawMi.mealItemName,
        ingredients,
      };
    }
  );

  return { mealItems: reconciledMealItems };
}

// Internal export for tests that want to assert on individual helpers.
export const __testing = {
  scalePer100g,
  guardMacro,
  resolveIngredientMacros,
  HALLUCINATION_GUARD_RATIO,
  MACRO_KEYS,
};
