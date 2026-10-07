/**
 * Missing macros a label's own energy proves are zero.
 *
 * Providers leave a nutrient out when the label did not print it, and labels
 * routinely skip a macro that is zero — a citrus tea lists energy and sugar,
 * not protein or fat. Kept as null, that one blank turned into "N/A" on every
 * meal logged from the product and an unknown on the whole day's totals.
 *
 * Null is not read as zero blindly. The stated calories decide: when the
 * macros that ARE listed already account for the energy (4P + 4C + 9F, fiber
 * excluded, as in `isPlausiblePer100g`), nothing is left for a missing macro to
 * carry, so zero is the label's own answer. When energy is left unexplained —
 * beer's alcohol, or a label that simply lost its fat line — the blank stays
 * null, because then something real is missing. So does a label whose listed
 * macros carry far MORE energy than it states: it contradicts itself, and the
 * plausibility gate cannot catch that while a macro is blank.
 */
import type { BarcodeProductRecord } from '@/lib/domain/barcode/types';

const MACRO_KEYS = ['proteinG', 'carbohydrateG', 'fatG'] as const;
const KCAL_PER_G = { proteinG: 4, carbohydrateG: 4, fatG: 9 } as const;

/**
 * A mismatch either way still read as rounding: 5 kcal per 100g, under ~0.6g
 * of fat or ~1.3g of protein or carbohydrate — about what a label's own
 * rounding leaves. Fixed, not a share of the label: 10% of a 500 kcal product
 * is 50 kcal, enough to hide 5g of protein and 7.5g of carbohydrate behind
 * blanks this would then call zero. A dense label just outside it keeps its
 * blanks, which is the safe way to be wrong.
 */
const TOLERANCE_KCAL = 5;

/** `product` with each missing macro set to 0 when the listed ones already
 *  explain its calories; otherwise unchanged. */
export function fillZeroMacros(
  product: BarcodeProductRecord
): BarcodeProductRecord {
  const kcal = product.caloriesKcal;
  if (kcal === null || kcal < 0) return product;
  if (MACRO_KEYS.every((key) => product[key] !== null)) return product;
  // Fiber is part of total carbohydrate (as `isPlausiblePer100g` counts it),
  // so listed fiber proves a blank carbohydrate line is not zero.
  if (product.carbohydrateG === null && (product.fiberG ?? 0) > 0) {
    return product;
  }

  let explained = 0;
  for (const key of MACRO_KEYS) {
    const grams = product[key];
    if (grams === null) continue;
    const effective =
      key === 'carbohydrateG'
        ? Math.max(0, grams - (product.fiberG ?? 0))
        : grams;
    explained += effective * KCAL_PER_G[key];
  }

  // Both ways: energy left over means a blank is real, and listed macros that
  // already exceed the label (0 kcal beside 10g of carbs) mean the label
  // contradicts itself — neither is evidence of zero.
  if (Math.abs(kcal - explained) > TOLERANCE_KCAL) return product;

  return {
    ...product,
    proteinG: product.proteinG ?? 0,
    carbohydrateG: product.carbohydrateG ?? 0,
    fatG: product.fatG ?? 0,
  };
}
