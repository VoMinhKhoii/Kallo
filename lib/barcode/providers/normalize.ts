/**
 * Shared numeric invariants for every barcode provider adapter.
 *
 * Adapters differ only in transport and field names — the rules here (a blank
 * string is missing, not zero; gram sizes bounded by the staging cap; kJ is
 * the trustworthy energy anchor; sodium stored in mg) must hold identically
 * for every source, and the cache-read path re-applies the sizing rule so
 * persisted rows obey the same bounds as freshly ingested ones.
 */
import { MAX_FOOD_ITEM_GRAMS } from '@/lib/barcode/constants';
import type { ParsedBarcodeProduct } from '@/lib/barcode/types';

export function parseNumber(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  // Blank/whitespace strings would coerce to 0 via Number(), turning unknown
  // OFF nutriments into authoritative zeroes — treat them as missing.
  if (typeof val === 'string' && val.trim() === '') return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
}

// Reject provider sizing that can't be a usable gram weight: non-positive, or
// larger than the staging cap (100kg). Keeps a stray "0"/"1500000" from
// becoming a nonsensical serving/package amount in the picker. Also applied on
// the cache-read path so persisted sizes get the identical validation.
export function parseSizeGrams(val: unknown): number | null {
  const num = parseNumber(val);
  if (num === null || num <= 0 || num > MAX_FOOD_ITEM_GRAMS) return null;
  return num;
}

const KCAL_PER_KJ = 1 / 4.184;

/**
 * Resolve per-100g calories from a provider's stated kcal and kJ figures.
 *
 * kcal = kJ / 4.184 by definition, so the kJ value is the more trustworthy
 * anchor: OFF products sometimes carry a garbage `energy-kcal_100g` (e.g.
 * 3.27 kcal for a 411 kcal drink) next to a correct kJ. Prefer the stated
 * kcal, but fall back to — or override with — the kJ-derived value when kcal
 * is missing, non-positive, or wildly inconsistent with kJ (differs by more
 * than ~25%).
 */
export function reconcileEnergy(
  statedKcal: number | null,
  energyKj: number | null
): number | null {
  const kcalFromKj =
    energyKj !== null && energyKj > 0 ? energyKj * KCAL_PER_KJ : null;

  let caloriesKcal = statedKcal;
  if (kcalFromKj !== null) {
    if (statedKcal === null || statedKcal <= 0) {
      caloriesKcal = Math.round(kcalFromKj);
    } else {
      const ratio = statedKcal / kcalFromKj;
      if (ratio < 0.75 || ratio > 1.25) {
        caloriesKcal = Math.round(kcalFromKj);
      }
    }
  }
  return caloriesKcal;
}

/**
 * Sodium in mg from a gram-denominated sodium figure, falling back to the salt
 * figure (salt = sodium × 2.5) when a label states only salt.
 */
export function sodiumMgFromGrams(
  sodiumG: number | null,
  saltG: number | null
): number | null {
  if (sodiumG !== null) return Math.round(sodiumG * 1000);
  if (saltG !== null) return Math.round((saltG / 2.5) * 1000);
  return null;
}

/**
 * Digits-only, leading-zero-stripped GTIN so UPC-A (12), EAN-13 and
 * zero-padded GTIN-14 spellings of the same product compare equal. Returns
 * null when nothing comparable remains, so two all-zero codes never count as
 * a match.
 */
export function normalizeGtin(val: unknown): string | null {
  if (typeof val !== 'string' && typeof val !== 'number') return null;
  const digits = String(val).replace(/\D/g, '').replace(/^0+/, '');
  return digits.length > 0 ? digits : null;
}

const MAX_KCAL_PER_100G = 950;
const MAX_MACRO_G_PER_100G = 100;
const ATWATER_OVERSHOOT_LIMIT = 1.4;

/**
 * Guard against values that cannot be a per-100g label: more energy than pure
 * fat carries, a macro exceeding the 100 g basis itself, or macros whose
 * Atwater energy (4P + 4C + 9F) overshoots the stated calories — the
 * signature of mixed per-serving/per-100g figures.
 *
 * The Atwater check is deliberately one-sided. Undershoot is legitimate:
 * alcohol and polyols carry energy no macro field accounts for, so a
 * symmetric check would reject correct beer and wine labels.
 */
export function isPlausiblePer100g(product: ParsedBarcodeProduct): boolean {
  const { caloriesKcal, proteinG, carbohydrateG, fatG, fiberG } = product;

  if (
    caloriesKcal !== null &&
    (caloriesKcal < 0 || caloriesKcal > MAX_KCAL_PER_100G)
  ) {
    return false;
  }
  for (const macro of [proteinG, carbohydrateG, fatG, fiberG]) {
    if (macro !== null && (macro < 0 || macro > MAX_MACRO_G_PER_100G)) {
      return false;
    }
  }

  if (caloriesKcal === null || caloriesKcal <= 0) return true;
  if (proteinG === null || carbohydrateG === null || fatG === null) return true;

  const atwaterKcal = 4 * proteinG + 4 * carbohydrateG + 9 * fatG;
  return atwaterKcal <= caloriesKcal * ATWATER_OVERSHOOT_LIMIT;
}

const NUTRITION_FIELDS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
  'fiberG',
  'sodiumMg',
] as const satisfies readonly (keyof ParsedBarcodeProduct)[];

/**
 * Calories are the absolute gate: a barcode match carrying no nutrition is a
 * product card the user cannot log, so it must never shadow a lower-ranked
 * source that does carry nutrition. Evaluated after {@link reconcileEnergy},
 * so kJ-only labels qualify.
 */
export function hasUsableNutrition(product: ParsedBarcodeProduct): boolean {
  return product.caloriesKcal !== null;
}

/** Count of populated nutrition fields; ranks two candidates that both pass
 *  the gate but neither of which is complete. */
export function nutritionCompleteness(product: ParsedBarcodeProduct): number {
  return NUTRITION_FIELDS.filter((key) => product[key] !== null).length;
}

/**
 * Calories plus at least two of protein/carbohydrate/fat — enough for the
 * product card to stand on its own, so the chain can return it immediately
 * and ignore sources still in flight.
 */
export function isNutritionComplete(product: ParsedBarcodeProduct): boolean {
  if (!hasUsableNutrition(product)) return false;
  const macros = [product.proteinG, product.carbohydrateG, product.fatG];
  return macros.filter((macro) => macro !== null).length >= 2;
}
