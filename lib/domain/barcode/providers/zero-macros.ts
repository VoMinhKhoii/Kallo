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
 * null, because then something real is missing.
 */
import type { BarcodeProductRecord } from '@/lib/domain/barcode/types';

const MACRO_KEYS = ['proteinG', 'carbohydrateG', 'fatG'] as const;
const KCAL_PER_G = { proteinG: 4, carbohydrateG: 4, fatG: 9 } as const;

/** Unexplained energy still read as rounding: 10% of the label, at least 5
 *  kcal per 100g — under ~0.6g of fat, ~1.3g of protein. */
const TOLERANCE_SHARE = 0.1;
const TOLERANCE_FLOOR_KCAL = 5;

/** `product` with each missing macro set to 0 when the listed ones already
 *  explain its calories; otherwise unchanged. */
export function fillZeroMacros(
  product: BarcodeProductRecord
): BarcodeProductRecord {
  const kcal = product.caloriesKcal;
  if (kcal === null || kcal < 0) return product;
  if (MACRO_KEYS.every((key) => product[key] !== null)) return product;

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

  const tolerance = Math.max(TOLERANCE_FLOOR_KCAL, kcal * TOLERANCE_SHARE);
  if (kcal - explained > tolerance) return product;

  return {
    ...product,
    proteinG: product.proteinG ?? 0,
    carbohydrateG: product.carbohydrateG ?? 0,
    fatG: product.fatG ?? 0,
  };
}
