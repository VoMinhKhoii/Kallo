import { z } from 'zod';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import {
  parseNumber,
  parseSizeGrams,
  reconcileEnergy,
  sodiumMgFromGrams,
} from '@/lib/domain/barcode/providers/normalize';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';

// Open Food Facts can be slow/unresponsive; bound the wait so the server
// action (awaited directly by the client dialog) never hangs indefinitely.
export const OFF_TIMEOUT_MS = 8000;

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

// Compatibility re-export. The type's home is `@/lib/domain/barcode/types`, but
// `components/logging/input/barcode-scanner-dialog.tsx` and
// `barcode-product-step.tsx` import it from here and are frozen by the
// file-size ratchet baseline, so this module cannot stop exporting the name.
export type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';

/**
 * Fetch food product details from Open Food Facts API using the barcode.
 */
export async function fetchProductFromOpenFoodFacts(
  barcode: string,
  timeoutMs: number = OFF_TIMEOUT_MS
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

    const caloriesKcal = reconcileEnergy(
      parseNumber(
        nutriments?.['energy-kcal_100g'] ?? nutriments?.['energy-kcal']
      ),
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
    };
  } catch (error) {
    console.error(
      `Error fetching from Open Food Facts API for barcode ${cleanBarcode}:`,
      error
    );
    return null;
  }
}
