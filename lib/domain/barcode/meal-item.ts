// One packaged product, scaled to the grams the user chose, as the frozen
// `PipelineMealItem` every downstream path already understands.
//
// Two paths need exactly this shape and must not drift: `stageBarcodeMeal`
// (scan → amount → save, its own pending row) and a barcode PICK made inside
// the composer, which is merged into an analysis beside whatever else was
// typed. Both must produce identical numbers for the same scan.
//
// The bounded triple is DEGENERATE — `{low:v, mid:v, high:v}` — for the same
// reason a relogged dish's is: confirm re-runs `goalAdjustNutrition` on every
// ingredient, and a printed label is not an estimate to be adjusted. See the
// header of `build-relog-pipeline-result.ts` for the arithmetic.
import { extractNutritionValues } from '@/lib/actions/logging/persisted-meal';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { PipelineMealItem } from '@/lib/ai/types/result';
import type { BarcodeCacheRow } from '@/lib/domain/barcode/cache';

/** Per-100g values scaled by `factor`, rounded to the stored precision. */
export function scaleNutrition(
  nutrition: NutritionValues,
  factor: number
): NutritionValues {
  const scaled = {} as NutritionValues;
  for (const key of NUTRITION_KEYS) {
    const val = nutrition[key];
    scaled[key] = val !== null ? Number((val * factor).toFixed(2)) : null;
  }
  return scaled;
}

/** The degenerate triple that makes confirm's goal-adjustment a no-op. */
export function buildBoundedNutrition(
  nutrition: NutritionValues
): BoundedNutrition {
  const bounded = {} as BoundedNutrition;
  for (const key of NUTRITION_KEYS) {
    const val = nutrition[key];
    bounded[key] = val !== null ? { low: val, mid: val, high: val } : null;
  }
  return bounded;
}

/** The scanned product at `grams`, as one meal item and its display name. */
export function buildBarcodeMealItem(
  row: BarcodeCacheRow,
  grams: number
): { item: PipelineMealItem; nutrition: NutritionValues } {
  const nutrition = scaleNutrition(extractNutritionValues(row), grams / 100);
  const bounded = buildBoundedNutrition(nutrition);
  return {
    nutrition,
    item: {
      name: row.namePrimary,
      displayedNutrition: nutrition,
      boundedNutrition: bounded,
      ingredients: [
        {
          ingredientName: row.namePrimary,
          foodCompositionId: row.id,
          estimatedGrams: grams,
          rawEquivalentGrams: grams,
          cookingMethod: null,
          userFacingUnit: 'g',
          matchConfidence: 1,
          boundedNutrition: bounded,
          displayedNutrition: nutrition,
        },
      ],
    },
  };
}
