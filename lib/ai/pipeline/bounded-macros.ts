import { absorbedOil, isDiscreteOilIngredient } from '@/lib/ai/absorbed-oil';
import { convertCookedToRaw, MAX_KCAL_PER_100G } from '../constants';
import type {
  BoundedEstimate,
  MacroBase,
  MatchedIngredient,
  NutritionPer100g,
} from '../types';
import type { MealDecompositionWithIds } from './ids';
import { ingredientGrams } from './ingredient-accessors';
import type { RawNutritionAdjustment } from './nutrition';

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

/**
 * Server-anchored flat triple: low = mid = high = value. Used wherever we
 * derive a definite DB-anchored number (matched protein, matched carb, or an
 * invalid LLM triple). The value is exact from
 * `base = DB per_100g × dbScalingGrams / 100`, so the low/high bounds carry
 * no additional information — emitting a spread would actively distort
 * downstream goal-adjusted displays (e.g., a cutting user would otherwise
 * see protein.low at 85 % of the DB truth).
 */
export function flatTriple(value: number): BoundedEstimate {
  const v = Math.max(0, value);
  return { low: v, mid: v, high: v };
}

/**
 * Detect a structurally-invalid bounded triple from the LLM: NaN/Infinity,
 * negative, or unordered (low > mid, mid > high, low > high). Used by the
 * fat guard to fall back to base when the LLM emits garbage.
 */
export function isStructurallyInvalidTriple(t: BoundedEstimate): boolean {
  for (const v of [t.low, t.mid, t.high]) {
    if (!Number.isFinite(v) || v < 0) return true;
  }
  return t.low > t.mid || t.mid > t.high || t.low > t.high;
}

/**
 * Apply the hallucination guard to a macro. Structurally invalid triples fall
 * back to the server anchor. Ordered triples outside the permitted envelope
 * are scaled to the nearest bound, preserving low <= mid <= high and the
 * LLM's relative uncertainty instead of discarding the estimate.
 *
 * `maxRatio` defaults to `HALLUCINATION_GUARD_RATIO` (3) for the legacy
 * fat-only path; callers pass tighter prep-notes ratios when applying the
 * guard to protein/carb/fat under user-typed modifiers.
 */
export function guardMacro(
  raw: BoundedEstimate,
  base: number,
  ingredientName: string,
  macroName: string,
  maxRatio: number = HALLUCINATION_GUARD_RATIO,
  ceilingAddend: number = 0
): BoundedEstimate {
  if (isStructurallyInvalidTriple(raw)) {
    console.warn(
      `[nutrition] hallucination_guard: replaced invalid ${macroName} of "${ingredientName}" with base=${base.toFixed(1)} (reason=invalid, raw mid=${raw.mid}, low=${raw.low}, high=${raw.high})`
    );
    return flatTriple(base);
  }
  const safeAddend =
    Number.isFinite(ceilingAddend) && ceilingAddend > 0 ? ceilingAddend : 0;
  if (base <= 0 && safeAddend === 0) {
    // No usable DB anchor or additive allowance. Trust a structurally sane
    // triple rather than manufacturing a zero for a nutrient the DB lacks.
    return raw;
  }
  const floor = base > 0 ? base / maxRatio : 0;
  const ceiling = Math.max(0, base) * maxRatio + safeAddend;
  const target = raw.mid > ceiling ? ceiling : raw.mid < floor ? floor : null;
  if (target === null) return raw;
  const reason = raw.mid > ceiling ? 'overshoot' : 'undershoot';
  const scale = raw.mid > 0 ? target / raw.mid : null;
  const clamped =
    scale === null ? flatTriple(target) : scaleBounded(raw, scale);
  console.warn(
    `[nutrition] hallucination_guard: clamped ${macroName} of "${ingredientName}" to ${target.toFixed(1)} (reason=${reason}, raw mid=${raw.mid}, low=${raw.low}, high=${raw.high}, base=${base.toFixed(1)}, maxRatio=${maxRatio}, ceilingAddend=${safeAddend.toFixed(1)})`
  );
  return clamped;
}

/**
 * Derive calories from the macro identity 4P + 4C + 9F, per bound. Always
 * preferred over the LLM's caloriesKcal mid because the macros themselves
 * are now structurally consistent (P/C server-anchored, F LLM-adjusted with
 * 3× guard) — keeping kcal in lockstep eliminates the macro_inconsistent
 * anomaly class entirely for matched ingredients.
 */
export function deriveCaloriesFromMacros(
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

export function scaleBounded(
  b: BoundedEstimate,
  factor: number
): BoundedEstimate {
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
export function resolveIngredientMacros(
  rawIng: RawNutritionAdjustment['mealItems'][number]['ingredients'][number],
  base: MacroBase | undefined,
  grams?: number,
  prepNotesPresent: boolean = false,
  cookingMethod: string | null = null,
  prepNotes: string[] = [],
  /**
   * True when a sibling ingredient in the same meal item IS the cooking fat.
   * The allowance is then suppressed so the oil is not counted twice — once in
   * its own row and again inside whatever it was fried in.
   */
  siblingOilPresent: boolean = false
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
  const oilMethodContext = [cookingMethod, ...prepNotes]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
  // The oil row itself keeps its allowance — it is not "absorbing" anything,
  // but suppressing it would clamp a legitimate 25g of oil back toward a base
  // that assumes an unfried food.
  const oilAllowance =
    siblingOilPresent && !isDiscreteOilIngredient(rawIng.ingredientName)
      ? 0
      : absorbedOil(oilMethodContext, grams ?? 0);
  const fatG = guardMacro(
    rawIng.fatG,
    base.fatG,
    rawIng.ingredientName,
    'fatG',
    prepNotesPresent ? PREP_NOTES_FAT_MAX_RATIO : HALLUCINATION_GUARD_RATIO,
    oilAllowance
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
