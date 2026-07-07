import { z } from 'zod';
import { MAX_FOOD_ITEM_GRAMS } from '@/lib/barcode/constants';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// Open Food Facts can be slow/unresponsive; bound the wait so the server
// action (awaited directly by the client dialog) never hangs indefinitely.
const OFF_TIMEOUT_MS = 8000;

// Open Food Facts API response validation schema
const openFoodFactsNutrimentsSchema = z
  .object({
    'energy-kcal_100g': z.union([z.number(), z.string()]).optional().nullable(),
    'energy-kcal': z.union([z.number(), z.string()]).optional().nullable(),
    'energy-kj_100g': z.union([z.number(), z.string()]).optional().nullable(),
    energy_100g: z.union([z.number(), z.string()]).optional().nullable(),
    carbohydrates_100g: z.union([z.number(), z.string()]).optional().nullable(),
    sugars_100g: z.union([z.number(), z.string()]).optional().nullable(),
    proteins_100g: z.union([z.number(), z.string()]).optional().nullable(),
    fat_100g: z.union([z.number(), z.string()]).optional().nullable(),
    fiber_100g: z.union([z.number(), z.string()]).optional().nullable(),
    sodium_100g: z.union([z.number(), z.string()]).optional().nullable(),
    salt_100g: z.union([z.number(), z.string()]).optional().nullable(),
  })
  .passthrough();

const openFoodFactsProductSchema = z
  .object({
    product_name: z.string().optional().nullable(),
    product_name_vi: z.string().optional().nullable(),
    product_name_en: z.string().optional().nullable(),
    brands: z.string().optional().nullable(),
    // Numeric grams per serving (OFF normalizes `serving_size` text to this).
    serving_quantity: z.union([z.number(), z.string()]).optional().nullable(),
    // Numeric grams in the whole package (net quantity).
    product_quantity: z.union([z.number(), z.string()]).optional().nullable(),
    nutriments: openFoodFactsNutrimentsSchema.optional().nullable(),
  })
  .passthrough();

export const openFoodFactsResponseSchema = z
  .object({
    status: z.union([z.number(), z.string()]).optional().nullable(),
    product: openFoodFactsProductSchema.optional().nullable(),
  })
  .passthrough();

export interface ParsedBarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  /** Grams per serving, if OFF provides a plausible value. */
  servingSizeG: number | null;
  /** Grams in the whole package (net quantity), if plausible. */
  packageSizeG: number | null;
}

function parseNumber(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  // Blank/whitespace strings would coerce to 0 via Number(), turning unknown
  // OFF nutriments into authoritative zeroes — treat them as missing.
  if (typeof val === 'string' && val.trim() === '') return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
}

// Reject OFF sizing that can't be a usable gram weight: non-positive, or larger
// than the staging cap (100kg). Keeps a stray "0"/"1500000" from becoming a
// nonsensical serving/package amount in the picker. Exported so the cache-read
// path (`lib/actions/barcode.ts`) validates persisted sizes the same way.
export function parseSizeGrams(val: unknown): number | null {
  const num = parseNumber(val);
  if (num === null || num <= 0 || num > MAX_FOOD_ITEM_GRAMS) return null;
  return num;
}

/**
 * Fetch food product details from Open Food Facts API using the barcode.
 */
export async function fetchProductFromOpenFoodFacts(
  barcode: string
): Promise<ParsedBarcodeProduct | null> {
  const cleanBarcode = barcode.trim();
  if (!/^\d+$/.test(cleanBarcode)) {
    return null;
  }

  const url = `https://world.openfoodfacts.org/api/v3/product/${cleanBarcode}.json`;

  try {
    const res = await fetchWithTimeout(
      (signal) =>
        fetch(url, {
          headers: {
            // Required by Open Food Facts policy to identify the app and avoid blocking
            'User-Agent':
              'Kallo Meal Tracker - Version 1.0 - Contact: support@kallo.fit',
            Accept: 'application/json',
          },
          next: { revalidate: 86400 }, // Cache on the server side for 24h
          signal,
        }),
      OFF_TIMEOUT_MS,
      'openfoodfacts'
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const parsed = openFoodFactsResponseSchema.safeParse(data);
    if (!parsed.success) {
      return null;
    }

    const { product } = parsed.data;
    if (!product) {
      return null;
    }

    // Name resolution: prefer Vietnamese, then English, then primary product_name
    const name =
      product.product_name_vi?.trim() ||
      product.product_name_en?.trim() ||
      product.product_name?.trim() ||
      `Product ${cleanBarcode}`;

    const brand = product.brands?.trim() || null;
    const nutriments = product.nutriments;

    // Macro/nutrient parsing. kcal = kJ / 4.184 by definition, so the kJ value
    // is the more trustworthy anchor: OFF products sometimes carry a garbage
    // `energy-kcal_100g` (e.g. 3.27 kcal for a 411 kcal drink) next to a
    // correct kJ. Prefer the stated kcal, but fall back to — or override with —
    // the kJ-derived value when kcal is missing, non-positive, or wildly
    // inconsistent with kJ (differs by more than ~25%).
    const KCAL_PER_KJ = 1 / 4.184;
    const statedKcal = parseNumber(
      nutriments?.['energy-kcal_100g'] ?? nutriments?.['energy-kcal']
    );
    const energyKj = parseNumber(
      nutriments?.['energy-kj_100g'] ?? nutriments?.energy_100g
    );
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

    const proteinG = parseNumber(nutriments?.proteins_100g);
    const carbohydrateG = parseNumber(nutriments?.carbohydrates_100g);
    const fatG = parseNumber(nutriments?.fat_100g);
    const fiberG = parseNumber(nutriments?.fiber_100g);

    // Sodium parsing (OFF reports in grams, we store in milligrams)
    let sodiumMg = null;
    const sodiumG = parseNumber(nutriments?.sodium_100g);
    if (sodiumG !== null) {
      sodiumMg = Math.round(sodiumG * 1000);
    } else {
      // Fallback: estimate from salt (salt = sodium * 2.5)
      const saltG = parseNumber(nutriments?.salt_100g);
      if (saltG !== null) {
        sodiumMg = Math.round((saltG / 2.5) * 1000);
      }
    }

    return {
      barcode: cleanBarcode,
      name,
      brand,
      caloriesKcal,
      proteinG,
      carbohydrateG,
      fatG,
      fiberG,
      sodiumMg,
      servingSizeG: parseSizeGrams(product.serving_quantity),
      packageSizeG: parseSizeGrams(product.product_quantity),
    };
  } catch (error) {
    console.error(
      `Error fetching from Open Food Facts API for barcode ${cleanBarcode}:`,
      error
    );
    return null;
  }
}
