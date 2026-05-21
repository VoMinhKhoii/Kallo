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
 * Default cooking-adjustment ratio for fat when no `prepNotes` are present.
 * Realistic frying-in-oil roughly doubles fat; 3× is the outer envelope.
 * Protein and carb are server-anchored in this path, so the guard fires
 * only on fat.
 */
const HALLUCINATION_GUARD_RATIO = 3;

/**
 * Tighter, prep-notes-aware bands used when the user typed verbatim
 * preparation modifiers (e.g. "bỏ da", "bỏ mỡ", "nước trong", "extra oil").
 *
 * Rationale (see plan): prep notes describe *minor* macro tweaks on the SAME
 * matched food. Quantity goes to `grams`; identity changes go to
 * `canonicalName`; ingredient removals go to the ingredients list. So a
 * sensible prep-note swing tops out around 2× fat (omelette w/ or w/o oil)
 * and ~1.4× P/C. The fat band is asymmetric in spirit but configured as a
 * symmetric ratio of 2 (covers both `bỏ da bỏ mỡ` → 0.5× and `extra oil`
 * → 2×). Worst-case kcal swing ≈ (P×1.4 + C×1.4 + F×2) / base ≈ 1.5–1.7×.
 */
const PREP_NOTES_FAT_MAX_RATIO = 2;
const PREP_NOTES_PC_MAX_RATIO = 1.4;

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

function scalePer100g(per100g: NutritionPer100g, grams: number): MacroBase {
  return {
    caloriesKcal: (per100g.caloriesKcal ?? 0) * (grams / 100),
    proteinG: (per100g.proteinG ?? 0) * (grams / 100),
    carbohydrateG: (per100g.carbohydrateG ?? 0) * (grams / 100),
    fatG: (per100g.fatG ?? 0) * (grams / 100),
  };
}

/**
 * Server-anchored flat triple: low = mid = high = value. Used wherever we
 * derive a definite DB-anchored number (matched protein, matched carb, fat
 * fallback when the guard rejects the LLM triple). The value is exact from
 * `base = DB per_100g × dbScalingGrams / 100`, so the low/high bounds carry
 * no additional information — emitting a spread would actively distort
 * downstream goal-adjusted displays (e.g., a cutting user would otherwise
 * see protein.low at 85 % of the DB truth).
 */
function flatTriple(value: number): BoundedEstimate {
  const v = Math.max(0, value);
  return { low: v, mid: v, high: v };
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
 * Apply the hallucination guard to a macro. Fall back to the server-anchored
 * band around `base` whenever the LLM triple is either outside the
 * `maxRatio` envelope (raw.mid > base × maxRatio OR raw.mid < base / maxRatio)
 * OR structurally invalid (unordered/negative/non-finite). Logs once per
 * fallback so we can monitor frequency.
 *
 * `maxRatio` defaults to `HALLUCINATION_GUARD_RATIO` (3) for the legacy
 * fat-only path; callers pass tighter prep-notes ratios when applying the
 * guard to protein/carb/fat under user-typed modifiers.
 */
function guardMacro(
  raw: BoundedEstimate,
  base: number,
  ingredientName: string,
  macroName: string,
  maxRatio: number = HALLUCINATION_GUARD_RATIO
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
    if (ratio > maxRatio) reason = 'overshoot';
    else if (ratio < 1 / maxRatio) reason = 'undershoot';
  }
  if (reason === null) return raw;
  console.warn(
    `[nutrition] hallucination_guard: snapped ${macroName} of "${ingredientName}" to base=${base.toFixed(1)} (reason=${reason}, raw mid=${raw.mid}, low=${raw.low}, high=${raw.high}, maxRatio=${maxRatio})`
  );
  return flatTriple(base);
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
 *   - Default path (no prep notes): protein/carb are flat triples at the
 *     DB-anchored base value (LLM ignored). Fat keeps the LLM triple subject
 *     to the 3× hallucination guard; calories derive from 4P + 4C + 9F.
 *   - Prep-notes path (`prepNotesPresent === true`): the user typed a
 *     verbatim preparation modifier (e.g. "bỏ da", "extra oil"). Protein,
 *     carb, and fat are all kept from the LLM under tighter guard bands
 *     (P/C ≤ 1.4× / ≥ 0.71× base, F ≤ 2× / ≥ 0.5× base). Calories still
 *     derive from 4P + 4C + 9F so the per-ingredient triple stays
 *     structurally consistent.
 *
 * For UNMATCHED ingredients (no `MacroBase`):
 *   - protein, carb, fat: from the LLM verbatim (no DB anchor to override).
 *   - calories: derived from 4P + 4C + 9F so the per-ingredient triple is
 *     structurally consistent — eliminates the meal_total kcal vs macro-identity
 *     gap (the 4410-vs-2983 anomaly).
 *   - density clamp: if either kcal.mid/100g or kcal.high/100g exceeds
 *     `UNMATCHED_DENSITY_CEILING`, scale all four macros by the inverse so the
 *     triple is forced back under the physical ceiling.
 */
function resolveIngredientMacros(
  rawIng: RawNutritionAdjustment['mealItems'][number]['ingredients'][number],
  base: MacroBase | undefined,
  grams?: number,
  prepNotesPresent: boolean = false
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
  const proteinG = prepNotesPresent
    ? guardMacro(
        rawIng.proteinG,
        base.proteinG,
        rawIng.ingredientName,
        'proteinG',
        PREP_NOTES_PC_MAX_RATIO
      )
    : flatTriple(base.proteinG);
  const carbohydrateG = prepNotesPresent
    ? guardMacro(
        rawIng.carbohydrateG,
        base.carbohydrateG,
        rawIng.ingredientName,
        'carbohydrateG',
        PREP_NOTES_PC_MAX_RATIO
      )
    : flatTriple(base.carbohydrateG);
  const fatG = guardMacro(
    rawIng.fatG,
    base.fatG,
    rawIng.ingredientName,
    'fatG',
    prepNotesPresent ? PREP_NOTES_FAT_MAX_RATIO : HALLUCINATION_GUARD_RATIO
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
  decomposedMealItem: MealDecompositionWithIds['mealItems'][number] | undefined,
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
      if (!base && (typeof grams !== 'number' || grams <= 0)) {
        // No matched base AND no grams to drive the unmatched density clamp.
        // The streaming preview will pass the LLM triple through unclamped.
        // The authoritative `reconcileNutritionIds` runs after the full stream
        // completes and re-resolves with the FIFO-matched decomposition entry,
        // so persisted data is unaffected — only the live SSE preview is.
        console.warn(
          `[nutrition] streaming_unmatched_no_grams: density clamp skipped for "${rawIng.ingredientName}" in "${rawItem.mealItemName}" (no decomposition match yet)`
        );
      }
      const prepNotesPresent = hasPrepNotes(decIng?.prepNotes);
      const resolved = resolveIngredientMacros(
        rawIng,
        base,
        grams,
        prepNotesPresent
      );
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

/** True iff the ingredient carries at least one non-empty prepNote. */
function hasPrepNotes(notes: string[] | undefined): boolean {
  if (!notes || notes.length === 0) return false;
  return notes.some((n) => typeof n === 'string' && n.trim().length > 0);
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
 *      - protein and carb are flat triples at the DB-anchored value (LLM ignored);
 *      - fat keeps the LLM triple subject to the 3× hallucination guard
 *        (falls back to a flat triple at base.fatG when the guard fires);
 *      - calories are derived from the macro identity (4P + 4C + 9F), so
 *        only fat's spread (when present) drives kcal's spread.
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
          const prepNotesPresent = hasPrepNotes(decomposedIng.prepNotes);
          const resolved = resolveIngredientMacros(
            rawIng,
            base,
            grams,
            prepNotesPresent
          );
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
  flatTriple,
  deriveCaloriesFromMacros,
  resolveIngredientMacros,
  HALLUCINATION_GUARD_RATIO,
  UNMATCHED_DENSITY_CEILING,
};
