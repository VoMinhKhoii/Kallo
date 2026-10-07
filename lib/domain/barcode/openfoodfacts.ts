import { z } from 'zod';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import { trustedProductImageUrl } from '@/lib/domain/barcode/image/image';
import {
  parseNumber,
  parseSizeGrams,
  reconcileEnergy,
  sodiumMgFromGrams,
} from '@/lib/domain/barcode/providers/normalize';
import { parseOffMicronutrients } from '@/lib/domain/barcode/providers/off-micronutrients';
import type {
  BarcodeAmountUnit,
  BarcodeProductRecord,
} from '@/lib/domain/barcode/types';

// Open Food Facts can be slow/unresponsive; bound the wait so the server
// action (awaited directly by the client dialog) never hangs indefinitely.
export const OFF_TIMEOUT_MS = 8000;

// Only what the parser reads. Without this OFF returns the whole product
// record, 20–36 KB for a single drink.
//
// `quantity` and `serving_size` are the raw texts the numeric sizes are derived
// from. The parser never reads them, but OFF v3 drops the derived
// `product_quantity` / `serving_quantity` pair from a response that also asks
// for `nutriments` unless they are requested too (observed 2026-09-26 on
// 8938507849131 and 8934673576390). Removing them silently loses all sizing.
const OFF_FIELDS = [
  'product_name',
  'product_name_vi',
  'product_name_en',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'product_quantity',
  'product_quantity_unit',
  'nutrition_data_per',
  'image_front_url',
  'nutriments',
].join(',');

// Open Food Facts API response validation schema
const openFoodFactsNutrimentsSchema = z
  .object({
    'energy-kcal_100g': z.union([z.number(), z.string()]).optional().nullable(),
    'energy-kj_100g': z.union([z.number(), z.string()]).optional().nullable(),
    energy_100g: z.union([z.number(), z.string()]).optional().nullable(),
    carbohydrates_100g: z.union([z.number(), z.string()]).optional().nullable(),
    sugars_100g: z.union([z.number(), z.string()]).optional().nullable(),
    proteins_100g: z.union([z.number(), z.string()]).optional().nullable(),
    fat_100g: z.union([z.number(), z.string()]).optional().nullable(),
    fiber_100g: z.union([z.number(), z.string()]).optional().nullable(),
    polyols_100g: z.union([z.number(), z.string()]).optional().nullable(),
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
    // Numeric amount per serving, in `serving_quantity_unit` (OFF normalizes
    // the `serving_size` text to this pair).
    serving_quantity: z.union([z.number(), z.string()]).optional().nullable(),
    serving_quantity_unit: z.string().optional().nullable(),
    // Numeric amount in the whole package, in `product_quantity_unit`.
    product_quantity: z.union([z.number(), z.string()]).optional().nullable(),
    product_quantity_unit: z.string().optional().nullable(),
    // What the label states nutrition per: '100g', '100ml' or 'serving'.
    nutrition_data_per: z.string().optional().nullable(),
    image_front_url: z.string().optional().nullable(),
    nutriments: openFoodFactsNutrimentsSchema.optional().nullable(),
  })
  .passthrough();

export const openFoodFactsResponseSchema = z
  .object({
    status: z.union([z.number(), z.string()]).optional().nullable(),
    product: openFoodFactsProductSchema.optional().nullable(),
  })
  .passthrough();

type OpenFoodFactsProduct = z.infer<typeof openFoodFactsProductSchema>;

// Compatibility re-export. The type's home is `@/lib/domain/barcode/types`, but
// `components/logging/input/barcode-scanner-dialog.tsx` and
// `barcode-product-step.tsx` import it from here and are frozen by the
// file-size ratchet baseline, so this module cannot stop exporting the name.
export type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';

/**
 * Drinks are 'ml'. A per-100ml label settles it; otherwise the package or
 * serving quantity does, unless one of them says grams — Vinamilk cartons are
 * stated per 100g yet sold as 1 l, and read as ml like the carton does.
 */
export function resolveAmountUnit(
  product: OpenFoodFactsProduct
): BarcodeAmountUnit {
  if (product.nutrition_data_per?.trim().toLowerCase() === '100ml') return 'ml';

  const units = [product.serving_quantity_unit, product.product_quantity_unit]
    .map((unit) => unit?.trim().toLowerCase())
    .filter((unit): unit is string => Boolean(unit));
  return units.includes('ml') && !units.includes('g') ? 'ml' : 'g';
}

/**
 * Fetch food product details from Open Food Facts API using the barcode.
 */
export async function fetchProductFromOpenFoodFacts(
  barcode: string,
  timeoutMs: number = OFF_TIMEOUT_MS
): Promise<BarcodeProductRecord | null> {
  const cleanBarcode = barcode.trim();
  if (!/^\d+$/.test(cleanBarcode)) {
    return null;
  }

  const url = `https://world.openfoodfacts.org/api/v3/product/${cleanBarcode}.json?fields=${OFF_FIELDS}`;

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
      timeoutMs,
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

    // Only `_100g` figures: the unsuffixed `energy-kcal` is in whatever basis
    // the label was typed in, which can be per serving.
    const caloriesKcal = reconcileEnergy(
      parseNumber(nutriments?.['energy-kcal_100g']),
      parseNumber(nutriments?.['energy-kj_100g'] ?? nutriments?.energy_100g)
    );

    const proteinG = parseNumber(nutriments?.proteins_100g);
    const carbohydrateG = parseNumber(nutriments?.carbohydrates_100g);
    const fatG = parseNumber(nutriments?.fat_100g);
    const fiberG = parseNumber(nutriments?.fiber_100g);

    // OFF reports sodium and salt in grams; we store milligrams.
    const sodiumMg = sodiumMgFromGrams(
      parseNumber(nutriments?.sodium_100g),
      parseNumber(nutriments?.salt_100g)
    );

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
      amountUnit: resolveAmountUnit(product),
      micronutrients: parseOffMicronutrients(nutriments),
      sourceImageUrl: trustedProductImageUrl(product.image_front_url),
      polyolsG: parseNumber(nutriments?.polyols_100g),
    };
  } catch (error) {
    console.error(
      `Error fetching from Open Food Facts API for barcode ${cleanBarcode}:`,
      error
    );
    return null;
  }
}
