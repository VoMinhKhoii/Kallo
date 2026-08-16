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
} from '@/lib/nutrition/absorbed-oil';
import type { RawNutritionAdjustment } from '../macro-resolution';
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
