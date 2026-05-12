import { convertCookedToRaw, MAX_KCAL_PER_100G } from '../constants';
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

/**
 * Cooking-adjustment ratio above which the LLM's fat mid is treated as a
 * hallucination and snapped to base. Realistic frying-in-oil roughly doubles
 * fat; 3× is the outer envelope. Protein and carb are server-anchored, so
 * this guard fires only on fat.
 */
const HALLUCINATION_GUARD_RATIO = 3;

/**
 * ±band applied to server-anchored protein and carb for matched ingredients.
 * Represents portion-grams uncertainty inherited from decomposition, not LLM
 * uncertainty (the LLM no longer touches P/C for matched ingredients).
 * Tune to ±0.10 or ±0.20 if downstream goal-bound display feels off.
 */
const SERVER_PC_BAND = 0.15;

/**
 * Hard density ceiling for unmatched ingredients: kcal/100g cannot exceed pure
 * fat. If the LLM emits a per-100g density above this, we scale all four
 * macros down so the triple becomes physically plausible. Aliased from
 * `MAX_KCAL_PER_100G` in `lib/ai/constants.ts` (single source of truth).
 */
const UNMATCHED_DENSITY_CEILING = MAX_KCAL_PER_100G;

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
 * Server-anchored band for protein/carb on matched ingredients (also reused
 * as the fat fallback when `guardMacro` rejects the LLM triple). Low/high are
 * ±SERVER_PC_BAND around mid.
 */
function serverAnchoredBand(midGrams: number): BoundedEstimate {
  const mid = Math.max(0, midGrams);
  return {
    low: Math.max(0, mid * (1 - SERVER_PC_BAND)),
    mid,
    high: mid * (1 + SERVER_PC_BAND),
  };
}

/**
 * Detect a structurally-invalid bounded triple from the LLM: NaN/Infinity,
 * negative, or unordered (low > mid, mid > high, low > high). Used by the
 * fat guard to fall back to base when the LLM emits garbage.
 */
function isStructurallyInvalidTriple(t: BoundedEstimate): boolean {
  for (const v of [t.low, t.mid, t.high]) {
    if (!Number.isFinite(v) || v < 0) return true;
  }
  return t.low > t.mid || t.mid > t.high || t.low > t.high;
}

/**
 * Apply the hallucination guard to fat. Fall back to the server-anchored band
 * around `base` whenever the LLM triple is either out of the
 * `HALLUCINATION_GUARD_RATIO` cooking-adjustment envelope OR structurally
 * invalid (unordered/negative/non-finite). Logs once per fallback so we can
 * monitor frequency.
 */
function guardMacro(
  raw: BoundedEstimate,
  base: number,
  ingredientName: string,
  macroName: string
): BoundedEstimate {
  if (base <= 0) {
    // No DB anchor for this nutrient (e.g., pepper has no kcal). Trust the
    // LLM if it's at least structurally sane; otherwise return a zero triple.
    return isStructurallyInvalidTriple(raw) ? { low: 0, mid: 0, high: 0 } : raw;
  }
  const structurallyInvalid = isStructurallyInvalidTriple(raw);
  let reason: 'invalid' | 'overshoot' | 'undershoot' | null = null;
  if (structurallyInvalid) {
    reason = 'invalid';
  } else {
    const ratio = raw.mid / base;
    if (ratio > HALLUCINATION_GUARD_RATIO) reason = 'overshoot';
    else if (ratio < 1 / HALLUCINATION_GUARD_RATIO) reason = 'undershoot';
  }
  if (reason === null) return raw;
  console.warn(
    `[nutrition] hallucination_guard: snapped ${macroName} of "${ingredientName}" to base=${base.toFixed(1)} (reason=${reason}, raw mid=${raw.mid}, low=${raw.low}, high=${raw.high})`
  );
  return serverAnchoredBand(base);
}

/**
 * Derive calories from the macro identity 4P + 4C + 9F, per bound. Always
 * preferred over the LLM's caloriesKcal mid because the macros themselves
 * are now structurally consistent (P/C server-anchored, F LLM-adjusted with
 * 3× guard) — keeping kcal in lockstep eliminates the macro_inconsistent
 * anomaly class entirely for matched ingredients.
 */
function deriveCaloriesFromMacros(
  protein: BoundedEstimate,
  carb: BoundedEstimate,
  fat: BoundedEstimate
): BoundedEstimate {
  return {
    low: 4 * protein.low + 4 * carb.low + 9 * fat.low,
    mid: 4 * protein.mid + 4 * carb.mid + 9 * fat.mid,
    high: 4 * protein.high + 4 * carb.high + 9 * fat.high,
  };
}

function scaleBounded(b: BoundedEstimate, factor: number): BoundedEstimate {
  return {
    low: Math.max(0, b.low * factor),
    mid: Math.max(0, b.mid * factor),
    high: Math.max(0, b.high * factor),
  };
}

/**
 * Resolve a single raw ingredient's macros against the precomputed base map.
 *
 * For MATCHED ingredients (has `MacroBase`):
 *   - protein and carb: server-anchored mid = base, low/high = ±SERVER_PC_BAND.
 *     LLM output for these macros is discarded (cooking method does not
 *     physically change P or C per gram).
 *   - fat: LLM owns mid (cooking-method adjustment — frying/oil-absorption is
 *     a real physical effect); the 3× hallucination guard catches gross errors.
 *   - calories: derived from the macro identity (4P + 4C + 9F).
 *
 * For UNMATCHED ingredients (no `MacroBase`):
 *   - protein, carb, fat: from the LLM verbatim (no DB anchor to override).
 *   - calories: derived from 4P + 4C + 9F so the per-ingredient triple is
 *     structurally consistent — eliminates the meal_total kcal vs macro-identity
 *     gap (the 4410-vs-2983 anomaly).
 *   - density clamp: if `kcal.mid / grams × 100` exceeds
 *     `UNMATCHED_DENSITY_CEILING`, scale all four macros by the inverse so the
 *     triple is forced back under the physical ceiling and the LLM's worst
 *     hallucinations (e.g., nem lụi 1200 kcal/100g) become impossible.
 */
function resolveIngredientMacros(
  rawIng: RawNutritionAdjustment['mealItems'][number]['ingredients'][number],
  base: MacroBase | undefined,
  grams?: number
): {
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
} {
  if (!base) {
    let proteinG = rawIng.proteinG;
    let carbohydrateG = rawIng.carbohydrateG;
    let fatG = rawIng.fatG;
    let caloriesKcal = deriveCaloriesFromMacros(proteinG, carbohydrateG, fatG);
    if (typeof grams === 'number' && grams > 0) {
      // Inspect BOTH mid and high density — a triple where mid is plausible but
      // high is inflated would otherwise pass through and leak >900 kcal/100g
      // into the upper bound.
      const densityMid = (caloriesKcal.mid / grams) * 100;
      const densityHigh = (caloriesKcal.high / grams) * 100;
      const worstDensity = Math.max(densityMid, densityHigh);
      if (worstDensity > UNMATCHED_DENSITY_CEILING) {
        const scaleFactor = UNMATCHED_DENSITY_CEILING / worstDensity;
        proteinG = scaleBounded(proteinG, scaleFactor);
        carbohydrateG = scaleBounded(carbohydrateG, scaleFactor);
        fatG = scaleBounded(fatG, scaleFactor);
        caloriesKcal = deriveCaloriesFromMacros(proteinG, carbohydrateG, fatG);
        console.warn(
          `[nutrition] density_clamp: scaled "${rawIng.ingredientName}" by ${scaleFactor.toFixed(2)}× (worst density ${worstDensity.toFixed(0)} kcal/100g, ceiling ${UNMATCHED_DENSITY_CEILING})`
        );
      }
    }
    return { caloriesKcal, proteinG, carbohydrateG, fatG };
  }
  const proteinG = serverAnchoredBand(base.proteinG);
  const carbohydrateG = serverAnchoredBand(base.carbohydrateG);
  const fatG = guardMacro(
    rawIng.fatG,
    base.fatG,
    rawIng.ingredientName,
    'fatG'
  );
  const caloriesKcal = deriveCaloriesFromMacros(proteinG, carbohydrateG, fatG);
  return { caloriesKcal, proteinG, carbohydrateG, fatG };
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
      const grams = decIng ? ingredientGrams(decIng) : undefined;
      const resolved = resolveIngredientMacros(rawIng, base, grams);
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
 * `ensureIdsOnDecomposition`, resolving macros against the base map in the
 * same pass.
 *
 * Strategy:
 *   1. Match meal items by name (FIFO queue for duplicate display names).
 *   2. Match ingredients by name within the meal item (same FIFO policy).
 *   3. For each matched ingredient with a DB-anchored base:
 *      - protein and carb come from base ± `SERVER_PC_BAND` (LLM ignored);
 *      - fat keeps the LLM mid subject to the 3× hallucination guard;
 *      - calories are derived from the macro identity (4P + 4C + 9F).
 *   4. For unmatched ingredients:
 *      - protein, carb, fat come from the LLM verbatim (no DB anchor);
 *      - calories are derived from 4P + 4C + 9F (structural identity);
 *      - if kcal.mid / grams × 100 > `UNMATCHED_DENSITY_CEILING`, all four
 *        macros are scaled down proportionally so the triple stays under the
 *        physical ceiling.
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
          const grams = ingredientGrams(decomposedIng);
          const resolved = resolveIngredientMacros(rawIng, base, grams);
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
  scaleBounded,
  guardMacro,
  isStructurallyInvalidTriple,
  serverAnchoredBand,
  deriveCaloriesFromMacros,
  resolveIngredientMacros,
  HALLUCINATION_GUARD_RATIO,
  SERVER_PC_BAND,
  UNMATCHED_DENSITY_CEILING,
};
