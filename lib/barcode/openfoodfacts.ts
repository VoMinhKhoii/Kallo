import { z } from 'zod';

// Open Food Facts API response validation schema
const openFoodFactsNutrimentsSchema = z.object({
  'energy-kcal_100g': z.union([z.number(), z.string()]).optional().nullable(),
  'energy-kcal': z.union([z.number(), z.string()]).optional().nullable(),
  'energy_100g': z.union([z.number(), z.string()]).optional().nullable(),
  carbohydrates_100g: z.union([z.number(), z.string()]).optional().nullable(),
  sugars_100g: z.union([z.number(), z.string()]).optional().nullable(),
  proteins_100g: z.union([z.number(), z.string()]).optional().nullable(),
  fat_100g: z.union([z.number(), z.string()]).optional().nullable(),
  fiber_100g: z.union([z.number(), z.string()]).optional().nullable(),
  sodium_100g: z.union([z.number(), z.string()]).optional().nullable(),
  salt_100g: z.union([z.number(), z.string()]).optional().nullable(),
}).passthrough();

const openFoodFactsProductSchema = z.object({
  product_name: z.string().optional().nullable(),
  product_name_vi: z.string().optional().nullable(),
  product_name_en: z.string().optional().nullable(),
  brands: z.string().optional().nullable(),
  nutriments: openFoodFactsNutrimentsSchema.optional().nullable(),
}).passthrough();

export const openFoodFactsResponseSchema = z.object({
  status: z.union([z.number(), z.string()]).optional().nullable(),
  product: openFoodFactsProductSchema.optional().nullable(),
}).passthrough();

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
}

function parseNumber(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
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
    const res = await fetch(url, {
      headers: {
        // Required by Open Food Facts policy to identify the app and avoid blocking
        'User-Agent': 'Nham Meal Tracker - Version 1.0 - Contact: support@nham.app',
        'Accept': 'application/json',
      },
      next: { revalidate: 86400 }, // Cache on the server side for 24h
    });

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

    // Macro/nutrient parsing
    let caloriesKcal = parseNumber(nutriments?.['energy-kcal_100g'] ?? nutriments?.['energy-kcal']);
    
    // Fallback: convert kJ to kcal (1 kcal = 4.184 kJ)
    if (caloriesKcal === null) {
      const energyKj = parseNumber(nutriments?.energy_100g);
      if (energyKj !== null) {
        caloriesKcal = Math.round(energyKj / 4.184);
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
    };
  } catch (error) {
    console.error(`Error fetching from Open Food Facts API for barcode ${cleanBarcode}:`, error);
    return null;
  }
}
