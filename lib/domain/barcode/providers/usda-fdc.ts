/**
 * USDA FoodData Central (Branded) adapter.
 *
 * FDC has no barcode endpoint — the branded dataset is queried through
 * full-text search — so result position proves nothing and only an exact GTIN
 * match may be returned. Free government API, ~1,000 requests/hour, keyed by
 * `USDA_API_KEY`; without the key the chain skips this provider entirely.
 */
import { z } from 'zod';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import {
  isPlausiblePer100g,
  normalizeGtin,
  parseNumber,
  parseSizeGrams,
  reconcileEnergy,
} from '@/lib/domain/barcode/providers/normalize';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';

const FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Tighter than the OFF bound: FDC is a low-latency government API and the two
// providers race, so a slow FDC must not stretch the scan's worst case.
export const FDC_TIMEOUT_MS = 4000;

/** `foodNutrients[].nutrientNumber` codes we map. 307 is already milligrams. */
const NUTRIENT_NUMBERS = {
  energyKcal: '208',
  energyKj: '268',
  proteinG: '203',
  carbohydrateG: '205',
  fatG: '204',
  fiberG: '291',
  sodiumMg: '307',
} as const;

/** Serving units that denote grams or (density-1 approximated) millilitres. */
const GRAM_EQUIVALENT_UNITS = new Set(['g', 'grm', 'ml', 'mlt']);

const numeric = z.union([z.number(), z.string()]).optional().nullable();

const fdcNutrientSchema = z
  .object({
    nutrientNumber: numeric,
    value: numeric,
  })
  .passthrough();

const fdcFoodSchema = z
  .object({
    fdcId: numeric,
    description: z.string().optional().nullable(),
    brandName: z.string().optional().nullable(),
    brandOwner: z.string().optional().nullable(),
    gtinUpc: numeric,
    servingSize: numeric,
    servingSizeUnit: z.string().optional().nullable(),
    foodNutrients: z.array(fdcNutrientSchema).optional().nullable(),
  })
  .passthrough();

export const fdcSearchResponseSchema = z
  .object({
    foods: z.array(fdcFoodSchema).optional().nullable(),
  })
  .passthrough();

type FdcFood = z.infer<typeof fdcFoodSchema>;
type NutrientKey = keyof typeof NUTRIENT_NUMBERS;
type NutrientValues = Record<NutrientKey, number | null>;

function readNutrients(food: FdcFood): NutrientValues {
  const byNumber = new Map<string, number>();
  for (const nutrient of food.foodNutrients ?? []) {
    const number = nutrient.nutrientNumber;
    const value = parseNumber(nutrient.value);
    if (number === undefined || number === null || value === null) continue;
    const key = String(number).trim();
    // First occurrence wins: FDC occasionally repeats a nutrient.
    if (!byNumber.has(key)) byNumber.set(key, value);
  }

  const values = {} as NutrientValues;
  for (const [field, number] of Object.entries(NUTRIENT_NUMBERS)) {
    values[field as NutrientKey] = byNumber.get(number) ?? null;
  }
  return values;
}

function round2(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}

function buildProduct(
  barcode: string,
  food: FdcFood,
  nutrients: NutrientValues,
  servingSizeG: number | null,
  scale: number
): ParsedBarcodeProduct {
  const scaled = (value: number | null) =>
    value === null ? null : value * scale;

  return {
    barcode,
    name: food.description?.trim() || `Product ${barcode}`,
    brand: food.brandName?.trim() || food.brandOwner?.trim() || null,
    caloriesKcal: round2(
      reconcileEnergy(scaled(nutrients.energyKcal), scaled(nutrients.energyKj))
    ),
    proteinG: round2(scaled(nutrients.proteinG)),
    carbohydrateG: round2(scaled(nutrients.carbohydrateG)),
    fatG: round2(scaled(nutrients.fatG)),
    fiberG: round2(scaled(nutrients.fiberG)),
    sodiumMg:
      nutrients.sodiumMg === null
        ? null
        : Math.round(nutrients.sodiumMg * scale),
    servingSizeG,
    // `packageWeight` is free text ("1 LB 2 OZ"); a wrong guess would feed the
    // quantity picker a wrong number, and null is a supported value.
    packageSizeG: null,
  };
}

function toProduct(barcode: string, food: FdcFood): ParsedBarcodeProduct {
  const nutrients = readNutrients(food);
  const unit = food.servingSizeUnit?.trim().toLowerCase() ?? '';
  const servingSizeG = GRAM_EQUIVALENT_UNITS.has(unit)
    ? parseSizeGrams(food.servingSize)
    : null;

  const perHundredGrams = buildProduct(
    barcode,
    food,
    nutrients,
    servingSizeG,
    1
  );
  if (isPlausiblePer100g(perHundredGrams)) return perHundredGrams;

  // The basis of the search endpoint's flattened nutrient values is documented
  // ambiguously, so the adapter self-validates rather than trusting it: when
  // the values cannot be per-100g but the per-serving reading can, take that.
  if (servingSizeG === null) return perHundredGrams;

  const perServing = buildProduct(
    barcode,
    food,
    nutrients,
    servingSizeG,
    100 / servingSizeG
  );
  if (!isPlausiblePer100g(perServing)) return perHundredGrams;

  console.warn(
    `USDA FDC ${String(food.fdcId)} nutrients read as per-serving (${servingSizeG}g) — rescaled to per-100g`
  );
  return perServing;
}

export async function fetchProductFromUsdaFdc(
  barcode: string,
  timeoutMs: number = FDC_TIMEOUT_MS
): Promise<ParsedBarcodeProduct | null> {
  const cleanBarcode = barcode.trim();
  if (!/^\d+$/.test(cleanBarcode)) return null;

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    // Normal state, not an error — the chain runs without FDC.
    console.info('USDA_API_KEY is unset — skipping FoodData Central lookup');
    return null;
  }

  const target = normalizeGtin(cleanBarcode);
  if (target === null) return null;

  const query = new URLSearchParams({
    api_key: apiKey,
    query: cleanBarcode,
    dataType: 'Branded',
    pageSize: '5',
  });

  try {
    const res = await fetchWithTimeout(
      (signal) =>
        fetch(`${FDC_SEARCH_URL}?${query}`, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 86400 }, // Cache on the server side for 24h
          signal,
        }),
      timeoutMs,
      'usda-fdc'
    );

    if (!res.ok) {
      console.error(
        `USDA FDC search failed for barcode ${cleanBarcode}: HTTP ${res.status}`
      );
      return null;
    }

    const parsed = fdcSearchResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.error(
        `USDA FDC returned an unexpected body for barcode ${cleanBarcode}`
      );
      return null;
    }

    // Full-text search ranks by text relevance, so a leading result can be a
    // different product entirely — only an exact GTIN match is the scan.
    const match = (parsed.data.foods ?? []).find(
      (food) => normalizeGtin(food.gtinUpc) === target
    );
    if (!match) return null;

    return toProduct(cleanBarcode, match);
  } catch (error) {
    console.error(
      `Error fetching from USDA FoodData Central for barcode ${cleanBarcode}:`,
      error
    );
    return null;
  }
}
