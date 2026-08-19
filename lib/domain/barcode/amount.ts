import { MAX_FOOD_ITEM_GRAMS } from '@/lib/domain/barcode/constants';

/** How the user is sizing the scanned product. */
export type AmountMode = 'serving' | 'package' | 'grams';

/** Stepper increment for the custom-grams control. */
export const GRAM_STEP = 50;
/** Shared cap so a large-but-valid package (OFF allows up to 100kg) is never
 *  silently clipped when resolved in serving/package mode. */
export const MAX_GRAMS = MAX_FOOD_ITEM_GRAMS;
export const MAX_SERVINGS = 99;
/** One-tap amounts offered under the grams stepper. */
export const QUICK_GRAM_OPTIONS = [50, 100, 150, 200, 250];

export const clampGrams = (g: number) => Math.min(MAX_GRAMS, Math.max(1, g));

export const clampServings = (n: number) =>
  Math.min(MAX_SERVINGS, Math.max(1, n));

/** Scale a per-100g nutrient to `grams`. Calories round to whole numbers,
 *  macros to one decimal, matching the source data's precision. */
export function scalePer100(
  per100: number | null,
  grams: number,
  decimals: number
): number | null {
  if (per100 === null) return null;
  const value = (per100 * grams) / 100;
  return decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
}

interface ProductSizes {
  servingSizeG: number | null;
  packageSizeG: number | null;
}

/** The modes this product has sizing for, in priority order. Grams is always
 *  offered as a fallback. */
export function availableAmountModes({
  servingSizeG,
  packageSizeG,
}: ProductSizes): AmountMode[] {
  const list: AmountMode[] = [];
  if (servingSizeG) list.push('serving');
  if (packageSizeG) list.push('package');
  list.push('grams');
  return list;
}

/** The gram amount the current mode resolves to. A mode whose sizing is
 *  missing falls back to the custom amount rather than to another mode. */
export function resolveGrams(
  mode: AmountMode,
  {
    servings,
    customGrams,
    servingSizeG,
    packageSizeG,
  }: ProductSizes & { servings: number; customGrams: number }
): number {
  if (mode === 'serving' && servingSizeG) {
    return clampGrams(Math.round(servings * servingSizeG));
  }
  if (mode === 'package' && packageSizeG) {
    return clampGrams(Math.round(packageSizeG));
  }
  return clampGrams(customGrams);
}
