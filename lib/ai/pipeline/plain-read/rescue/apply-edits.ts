/**
 * Pure per-ingredient edit application and physical density/macro invariants
 * for the plain-read seeing rescue (`rescue.ts`).
 */
import {
  mapIngredients,
  scaleBoundedNutrition,
  scaleNutritionValues,
} from '@/lib/ai/pipeline/assemble/result-scale';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type {
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';
import type { RescueOutput } from './prompt';

/** Physical ceiling: pure fat is ~9 kcal/g; nothing in food can exceed this. */
const MAX_KCAL_PER_GRAM = 9.0;
/** Rows at or above this density are pure fats/oils and must keep their real density. */
const PURE_FAT_DENSITY_FLOOR = 8.0;
/** Minimum density allowed when editing a pure-fat row (blocks smuggling non-oil food onto oil). */
const PURE_FAT_EDIT_MIN_DENSITY = 7.5;

function addFatAndCalories(
  bounded: BoundedNutrition,
  displayed: NutritionValues,
  extraFatG: number,
  extraKcal: number
): { bounded: BoundedNutrition; displayed: NutritionValues } {
  const nextBounded = { ...bounded };
  const nextDisplayed = { ...displayed };
  if (extraFatG > 0) {
    const prev = bounded.fatG ?? { low: 0, mid: 0, high: 0 };
    nextBounded.fatG = {
      low: prev.low + extraFatG,
      mid: prev.mid + extraFatG,
      high: prev.high + extraFatG,
    };
    nextDisplayed.fatG = (displayed.fatG ?? 0) + extraFatG;
  }
  if (extraKcal > 0) {
    const prev = bounded.caloriesKcal ?? { low: 0, mid: 0, high: 0 };
    nextBounded.caloriesKcal = {
      low: prev.low + extraKcal,
      mid: prev.mid + extraKcal,
      high: prev.high + extraKcal,
    };
    nextDisplayed.caloriesKcal = (displayed.caloriesKcal ?? 0) + extraKcal;
  }
  return { bounded: nextBounded, displayed: nextDisplayed };
}

function solveMacroRebalance(
  ing: ProcessedIngredient,
  safeGrams: number,
  safeKcal: number,
  oldKcal: number
): { baseScale: number; extraFatG: number; extraKcal: number } {
  const kcalRatio = safeKcal / oldKcal;
  const oldMacroGrams =
    (ing.displayedNutrition.proteinG ?? 0) +
    (ing.displayedNutrition.carbohydrateG ?? 0) +
    (ing.displayedNutrition.fatG ?? 0) +
    (ing.alcoholG ?? 0);

  if (!(oldMacroGrams > 0) || kcalRatio * oldMacroGrams <= safeGrams) {
    return { baseScale: kcalRatio, extraFatG: 0, extraKcal: 0 };
  }

  // Uniform scaling would push P + C + F + alcohol past food weight: shift the
  // excess density into fat (9 kcal/g) so P + C + F <= grams and bounded /
  // displayed values still commute with goal adjustment.
  const denom = MAX_KCAL_PER_GRAM * oldMacroGrams - oldKcal;
  if (!(denom > 1e-6)) {
    return {
      baseScale: safeGrams / oldMacroGrams,
      extraFatG: 0,
      extraKcal: 0,
    };
  }
  const baseScale = Math.max(
    0,
    (MAX_KCAL_PER_GRAM * safeGrams - safeKcal) / denom
  );
  return {
    baseScale,
    extraFatG: Math.max(0, safeGrams - baseScale * oldMacroGrams),
    extraKcal: Math.max(0, safeKcal - baseScale * oldKcal),
  };
}

/** Returns the updated ingredient, or `null` when the edit violates a guard. */
function editIngredient(
  ing: ProcessedIngredient,
  grams: number,
  kcal: number
): ProcessedIngredient | null {
  const oldGrams = ing.estimatedGrams;
  const oldKcal = ing.displayedNutrition.caloriesKcal ?? 0;
  const tableKcal = ing.boundedNutrition.caloriesKcal?.mid ?? oldKcal;

  // Guard against smuggling non-oil food onto a pure-oil row (e.g. turning
  // cooking oil into 2.7 kcal/g). Use the un-shifted table midpoint so cut/bulk
  // goal adjustments never hide a pure-fat row.
  if (oldGrams > 0 && tableKcal / oldGrams >= PURE_FAT_DENSITY_FLOOR) {
    if (grams > 0 && kcal / grams < PURE_FAT_EDIT_MIN_DENSITY) return null;
  }

  const safeGrams = Math.max(0, grams);
  // Hard physics cap: no ingredient can exceed pure fat (9.0 kcal/g), and
  // zero grams always carries zero calories.
  const safeKcal = Math.max(0, Math.min(kcal, safeGrams * MAX_KCAL_PER_GRAM));
  const gramsRatio = oldGrams > 0 ? safeGrams / oldGrams : 0;
  const rawEquivalentGrams =
    oldGrams > 0 ? ing.rawEquivalentGrams * gramsRatio : safeGrams;

  // Without existing calories we have no macro split to lift above 0 kcal,
  // but resizing a 0-kcal row (broth, salt, mineral water) scales its
  // micronutrients proportionally to grams (and zeroes them at 0 g).
  if (!(oldKcal > 0)) {
    if (safeKcal > 0) return null;
    return {
      ...ing,
      estimatedGrams: safeGrams,
      rawEquivalentGrams,
      boundedNutrition: scaleBoundedNutrition(ing.boundedNutrition, gramsRatio),
      displayedNutrition: scaleNutritionValues(
        ing.displayedNutrition,
        gramsRatio
      ),
    };
  }

  const { baseScale, extraFatG, extraKcal } = solveMacroRebalance(
    ing,
    safeGrams,
    safeKcal,
    oldKcal
  );
  let bounded = scaleBoundedNutrition(ing.boundedNutrition, baseScale);
  let displayed = scaleNutritionValues(ing.displayedNutrition, baseScale);
  if (extraFatG > 0 || extraKcal > 0) {
    ({ bounded, displayed } = addFatAndCalories(
      bounded,
      displayed,
      extraFatG,
      extraKcal
    ));
  }

  return {
    ...ing,
    estimatedGrams: safeGrams,
    rawEquivalentGrams,
    boundedNutrition: bounded,
    displayedNutrition: displayed,
    ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * baseScale }),
  };
}

/**
 * Apply targeted per-ingredient rescue edits to the unheld `raw` pipeline
 * result. Locked (`typedAmount`) ingredients are never touched, physical
 * calorie-density and macro-mass bounds are enforced, and dish/meal totals
 * are recomputed directly via `mapIngredients`.
 */
export function applyRescueEdits(
  raw: PipelineResult,
  edits: RescueOutput['edits']
): { result: PipelineResult; appliedCount: number } {
  if (edits.length === 0) return { result: raw, appliedCount: 0 };
  const byIndex = new Map(edits.map((e) => [e.index, e]));
  let appliedCount = 0;

  const result = mapIngredients(raw, (ing, flatIndex) => {
    const edit = byIndex.get(flatIndex);
    if (
      !edit ||
      ing.typedAmount ||
      !Number.isFinite(edit.grams) ||
      !Number.isFinite(edit.kcal)
    ) {
      return ing;
    }
    const updated = editIngredient(ing, edit.grams, edit.kcal);
    if (!updated) return ing;
    appliedCount++;
    return updated;
  });

  return { result, appliedCount };
}
