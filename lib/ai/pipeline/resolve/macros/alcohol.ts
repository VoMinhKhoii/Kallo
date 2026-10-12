/**
 * Alcohol energy hidden in a food row.
 *
 * Food rows carry no alcohol column, but their kcal includes ethanol (7 kcal/g)
 * while their P/C/F do not. The pipeline rebuilds kcal from 4P + 4C + 9F, so
 * without this a beer's ethanol vanished (2 cans: ~106 kcal shown, 284 real).
 *
 * The gap `kcal − (4P + 4C + 9F)` is only read as alcohol on beverage rows:
 * across the catalog, beverage rows with a gap ≥ 15 kcal/100g are all
 * alcoholic (light beer ~21, wine ~70, spirits ~230), while non-alcoholic
 * drinks sit near 0. Other groups have gaps from Atwater-factor differences,
 * vinegar's acetic acid or dried-egg rounding — none of that is alcohol.
 */

import type { NutritionPer100g } from '@/lib/ai/types/matching';

export const ALCOHOL_KCAL_PER_G = 7;

/** Below this per-100g gap a beverage row is treated as alcohol-free. */
const MIN_ALCOHOL_KCAL_PER_100G = 15;

/** Food groups (`type_en`) that hold alcoholic drinks across our sources. */
const BEVERAGE_GROUPS = new Set(['beverages', 'beverage and liquor']);

export function alcoholKcalPer100g(
  per100g: NutritionPer100g,
  foodGroupEn: string | undefined
): number {
  if (!foodGroupEn) return 0;
  if (!BEVERAGE_GROUPS.has(foodGroupEn.trim().toLowerCase())) return 0;
  if (per100g.caloriesKcal == null) return 0;
  const gap =
    per100g.caloriesKcal -
    (4 * (per100g.proteinG ?? 0) +
      4 * (per100g.carbohydrateG ?? 0) +
      9 * (per100g.fatG ?? 0));
  return gap >= MIN_ALCOHOL_KCAL_PER_100G ? gap : 0;
}
