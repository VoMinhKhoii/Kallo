/**
 * Per-ingredient macro policy: given one raw LLM triple set and (optionally)
 * a DB-anchored base, decide what actually ships.
 *
 * This is where the guard bands, the absorbed-oil allowance and the unmatched
 * density ceiling are chosen. The arithmetic they are expressed in lives in
 * `macro-guard.ts`; the DB anchor itself comes from `macro-base.ts`.
 */

import { MAX_KCAL_PER_100G } from '@/lib/ai/pipeline/contracts/nutrition-limits';
import type { MacroBase } from '@/lib/ai/types/nutrition-adjustment';
import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';
import {
  absorbedOil,
  isDiscreteOilIngredient,
  prepNotesAskForExtraFat,
} from '@/lib/domain/nutrition/absorbed-oil';
import type { RawNutritionAdjustment } from '../macro-resolution';
import { ALCOHOL_KCAL_PER_G } from './alcohol';
import { scalePer100g } from './macro-base';
import {
  deriveCaloriesFromMacros,
  flatTriple,
  guardMacro,
  HALLUCINATION_GUARD_RATIO,
  isStructurallyInvalidTriple,
  PREP_NOTES_FAT_MAX_RATIO,
  PREP_NOTES_PC_MAX_RATIO,
  scaleBounded,
} from './macro-guard';

/** Upper fat guard when cooking oil is already in a sibling row or a fried DB row. */
export const FAT_ACCOUNTED_MAX_RATIO = 1.25;
/** Plain butter (without prep notes) stays near its DB fat composition. */
export const BUTTER_FAT_MIN_RATIO = 0.9;
export const BUTTER_FAT_MAX_RATIO = 1.05;

/**
 * Hard density ceiling for unmatched ingredients: kcal/100g cannot exceed pure
 * fat. If the LLM emits a per-100g density above this, we scale all four
 * macros down so the triple becomes physically plausible. Aliased from
 * `MAX_KCAL_PER_100G` in `lib/ai/pipeline/contracts/nutrition-limits.ts` (single source of truth).
 */
const UNMATCHED_DENSITY_CEILING = MAX_KCAL_PER_100G;

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
 *   - Either path: an alcoholic row's ethanol energy (`base.alcoholKcal`) is
 *     added to kcal and reported as `alcoholG`.
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
  alcoholG?: number;
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
  const fatG = resolveFatMacro({
    rawIng,
    base,
    grams,
    prepNotesPresent,
    cookingMethod,
    prepNotes,
    siblingOilPresent,
  });
  const macroKcal = deriveCaloriesFromMacros(proteinG, carbohydrateG, fatG);
  // Ethanol is in the row's kcal but in none of P/C/F, so the 4/4/9 identity
  // alone drops it. Added back flat: it comes from the DB row, not the LLM.
  const alcoholKcal = base.alcoholKcal ?? 0;
  if (alcoholKcal <= 0) {
    return { caloriesKcal: macroKcal, proteinG, carbohydrateG, fatG };
  }
  const caloriesKcal = {
    low: macroKcal.low + alcoholKcal,
    mid: macroKcal.mid + alcoholKcal,
    high: macroKcal.high + alcoholKcal,
  };
  const alcoholG = alcoholKcal / ALCOHOL_KCAL_PER_G;
  return { caloriesKcal, proteinG, carbohydrateG, fatG, alcoholG };
}

function resolveFatMacro(args: {
  rawIng: RawNutritionAdjustment['mealItems'][number]['ingredients'][number];
  base: MacroBase;
  grams: number | undefined;
  prepNotesPresent: boolean;
  cookingMethod: string | null;
  prepNotes: string[];
  siblingOilPresent: boolean;
}): BoundedEstimate {
  const {
    rawIng,
    base,
    grams,
    prepNotesPresent,
    cookingMethod,
    prepNotes,
    siblingOilPresent,
  } = args;

  // Pure oil (≥95 g fat, ≤1 g P/C per 100 g) is anchored to its DB fat so
  // Call 2 cannot under-report 10 g oil as 7 g fat. Keeps {low, mid, high}.
  if (base.pureFatKind === 'oil') {
    return flatTriple(base.fatG);
  }
  // Plain butter (80–95 g fat, ≤2 g P/C per 100 g) without prep notes stays
  // tight around its DB fat; with prep notes, fall through to today's rules.
  if (base.pureFatKind === 'butter' && !prepNotesPresent) {
    return guardMacro(
      rawIng.fatG,
      base.fatG,
      rawIng.ingredientName,
      'fatG',
      BUTTER_FAT_MAX_RATIO,
      0,
      BUTTER_FAT_MIN_RATIO
    );
  }

  const isOwnOil =
    base.pureFatKind === 'butter' ||
    isDiscreteOilIngredient(rawIng.ingredientName);
  const defaultMaxRatio = prepNotesPresent
    ? PREP_NOTES_FAT_MAX_RATIO
    : HALLUCINATION_GUARD_RATIO;
  const extraFatRequested =
    prepNotesPresent && prepNotesAskForExtraFat(prepNotes);

  // When frying fat is already accounted for — either by a sibling cooking-fat
  // row or because the matched DB row is already fried — cap fat at 1.25× base
  // with no oil allowance, leaving the floor unchanged so reduction prep notes
  // (e.g. "bỏ da", "bỏ mỡ") still work. Extra-fat prep notes unlock 2×.
  if (
    !isOwnOil &&
    (siblingOilPresent || base.matchedRowIsFried) &&
    !extraFatRequested
  ) {
    // The guard leaves a zero base alone (it cannot tell a missing value from
    // a real zero); a row that states 0 g fat holds 0 g here, its oil being
    // counted elsewhere.
    if (base.fatIsZero) return flatTriple(0);
    return guardMacro(
      rawIng.fatG,
      base.fatG,
      rawIng.ingredientName,
      'fatG',
      FAT_ACCOUNTED_MAX_RATIO,
      0,
      1 / defaultMaxRatio
    );
  }

  const oilMethodContext = [cookingMethod, ...prepNotes]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
  const oilAllowance =
    siblingOilPresent && !isOwnOil
      ? 0
      : absorbedOil(oilMethodContext, grams ?? 0);
  return guardMacro(
    rawIng.fatG,
    base.fatG,
    rawIng.ingredientName,
    'fatG',
    defaultMaxRatio,
    oilAllowance
  );
}

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
