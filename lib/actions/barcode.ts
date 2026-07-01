'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { extractNutritionValues } from '@/lib/actions/persisted-meal';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type {
  BoundedNutrition,
  NutritionValues,
  PipelineResult,
} from '@/lib/ai/types';
import { requireAuthAndProfile } from '@/lib/auth';
import {
  fetchProductFromOpenFoodFacts,
  type ParsedBarcodeProduct,
} from '@/lib/barcode/openfoodfacts';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import {
  ingredientSources,
  pendingAnalyses,
  vietnameseFoodComposition,
} from '@/lib/db/schema';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

const searchBarcodeSchema = z.object({
  barcode: z
    .string()
    .min(1, 'Mã vạch không được để trống')
    .regex(/^\d+$/, 'Mã vạch chỉ được chứa số'),
});

const stageBarcodeMealSchema = z.object({
  barcode: z
    .string()
    .min(1, 'Mã vạch không được để trống')
    .regex(/^\d+$/, 'Mã vạch chỉ được chứa số'),
  grams: z
    .number()
    .positive('Khối lượng phải lớn hơn 0')
    .max(100000, 'Khối lượng quá lớn'),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/**
 * Stable, locale-agnostic error codes returned to the client, which maps them
 * to a localized message via `t('barcodeError.<code>')`. Server-side text is
 * never returned directly, so error copy honors the user's locale.
 */
export type BarcodeErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'not_cached'
  | 'stage_failed'
  | 'server_error';

function getErrorCode(error: unknown): BarcodeErrorCode {
  return error instanceof z.ZodError ? 'invalid_input' : 'server_error';
}

/** Coerce a Drizzle numeric column (string | null) to a positive number, or
 *  null. Used for serving/package sizes, where 0 means "not provided". */
function parsePositiveNumeric(val: string | null): number | null {
  if (val === null) return null;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function scaleNutrition(
  nutrition: NutritionValues,
  factor: number
): NutritionValues {
  const scaled = {} as NutritionValues;
  for (const key of NUTRITION_KEYS) {
    const val = nutrition[key];
    scaled[key] = val !== null ? Number((val * factor).toFixed(2)) : null;
  }
  return scaled;
}

function buildBoundedNutrition(nutrition: NutritionValues): BoundedNutrition {
  const bounded = {} as BoundedNutrition;
  for (const key of NUTRITION_KEYS) {
    const val = nutrition[key];
    bounded[key] = val !== null ? { low: val, mid: val, high: val } : null;
  }
  return bounded;
}

/**
 * Search for a product by barcode. If not in DB, fetches from Open Food Facts API
 * and caches it in vietnamese_food_composition.
 */
export async function searchBarcodeAction(input: {
  barcode: string;
}): Promise<
  | { success: true; data: ParsedBarcodeProduct }
  | { success: false; code: BarcodeErrorCode }
> {
  try {
    const parsed = searchBarcodeSchema.parse(input);
    await requireAuthAndProfile();

    const dbId = `off_${parsed.barcode}`;

    // 1. Check local cache
    const [cached] = await db
      .select()
      .from(vietnameseFoodComposition)
      .where(eq(vietnameseFoodComposition.id, dbId))
      .limit(1);

    if (cached) {
      // Parse brand and name from primary name e.g. "[Coca-Cola] Original Taste"
      let brand: string | null = null;
      let name = cached.namePrimary;
      const brandMatch = cached.namePrimary.match(/^\[(.*?)\]\s*(.*)$/);
      if (brandMatch) {
        brand = brandMatch[1];
        name = brandMatch[2];
      }

      const nutrition = extractNutritionValues(cached);

      return {
        success: true,
        data: {
          barcode: parsed.barcode,
          name,
          brand,
          caloriesKcal: nutrition.caloriesKcal,
          proteinG: nutrition.proteinG,
          carbohydrateG: nutrition.carbohydrateG,
          fatG: nutrition.fatG,
          fiberG: nutrition.fiberG,
          sodiumMg: nutrition.sodiumMg,
          // numeric columns surface as strings; coerce and drop anything
          // non-positive so the picker only offers real serving/package sizes.
          servingSizeG: parsePositiveNumeric(cached.servingSizeG),
          packageSizeG: parsePositiveNumeric(cached.packageSizeG),
        },
      };
    }

    // 2. Fetch from Open Food Facts and resolve the OFF source id in parallel —
    // the source lookup is independent of the product fetch, so there's no
    // reason to wait for the (slow, external) fetch before starting it.
    const [product, sourceRow] = await Promise.all([
      fetchProductFromOpenFoodFacts(parsed.barcode),
      db
        .select({ id: ingredientSources.id })
        .from(ingredientSources)
        .where(eq(ingredientSources.code, 'OFF'))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!product) {
      return { success: false, code: 'not_found' };
    }

    // The 'OFF' ingredient source is seeded by migration; its absence is a
    // server misconfiguration, not a user error. Fail loudly rather than
    // silently mislabeling provenance with an arbitrary fallback id.
    if (!sourceRow) {
      console.error(
        "Missing 'OFF' ingredient source — cannot cache barcode product"
      );
      return { success: false, code: 'server_error' };
    }

    // 3. Cache in Database
    const sourceId = sourceRow.id;
    const namePrimary = product.brand
      ? `[${product.brand}] ${product.name}`
      : product.name;

    // onConflictDoNothing: two concurrent first-time scans of the same barcode
    // would otherwise race on the primary key; the loser is harmlessly ignored.
    await db
      .insert(vietnameseFoodComposition)
      .values({
        id: dbId,
        namePrimary,
        nameEn: product.name,
        typeVn: 'Sản phẩm đóng gói',
        typeEn: 'Packaged product',
        sourceId,
        state: 'cooked',
        servingSizeG:
          product.servingSizeG !== null ? String(product.servingSizeG) : null,
        packageSizeG:
          product.packageSizeG !== null ? String(product.packageSizeG) : null,
        caloriesKcal:
          product.caloriesKcal !== null ? String(product.caloriesKcal) : null,
        proteinG: product.proteinG !== null ? String(product.proteinG) : null,
        carbohydrateG:
          product.carbohydrateG !== null ? String(product.carbohydrateG) : null,
        fatG: product.fatG !== null ? String(product.fatG) : null,
        fiberG: product.fiberG !== null ? String(product.fiberG) : null,
        sodiumMg: product.sodiumMg !== null ? String(product.sodiumMg) : null,
        searchText: namePrimary.toLowerCase(),
        searchTextAscii: namePrimary.toLowerCase(),
      })
      .onConflictDoNothing({ target: vietnameseFoodComposition.id });

    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error('Error in searchBarcodeAction:', error);
    return {
      success: false,
      code: getErrorCode(error),
    };
  }
}

/**
 * Scales the nutrition values for a barcode product and stages it in pending_analyses.
 */
export async function stageBarcodeMealAction(input: {
  barcode: string;
  grams: number;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<
  | { success: true; analysisId: string }
  | { success: false; code: BarcodeErrorCode }
> {
  try {
    const parsed = stageBarcodeMealSchema.parse(input);
    const { user } = await requireAuthAndProfile();

    const dbId = `off_${parsed.barcode}`;

    // 1. Get cached product
    const [dbProduct] = await db
      .select()
      .from(vietnameseFoodComposition)
      .where(eq(vietnameseFoodComposition.id, dbId))
      .limit(1);

    if (!dbProduct) {
      return { success: false, code: 'not_cached' };
    }

    const nutrition = extractNutritionValues(dbProduct);
    const scaledNutrition = scaleNutrition(nutrition, parsed.grams / 100);
    const boundedNutrition = buildBoundedNutrition(scaledNutrition);

    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );

    // 2. Build PipelineResult object mimicking natural language decomposition output
    const pipelineResult: PipelineResult = {
      mealSlot: null,
      confidenceOverall: 'high',
      unmatchedIngredients: [],
      displayedNutrition: scaledNutrition,
      boundedNutrition: boundedNutrition,
      mealItems: [
        {
          name: dbProduct.namePrimary,
          displayedNutrition: scaledNutrition,
          boundedNutrition: boundedNutrition,
          ingredients: [
            {
              ingredientName: dbProduct.namePrimary,
              foodCompositionId: dbProduct.id,
              estimatedGrams: parsed.grams,
              rawEquivalentGrams: parsed.grams,
              cookingMethod: null,
              userFacingUnit: 'g',
              matchConfidence: 1,
              boundedNutrition: boundedNutrition,
              displayedNutrition: scaledNutrition,
            },
          ],
        },
      ],
    };

    // 3. Insert into pending_analyses
    const [inserted] = await db
      .insert(pendingAnalyses)
      .values({
        userId: user.id,
        pipelineResult,
        rawInput: `${dbProduct.namePrimary} (${parsed.grams}g)`,
        entryMode: 'precise',
        loggedAt,
      })
      .returning({ id: pendingAnalyses.id });

    if (!inserted) {
      return { success: false, code: 'stage_failed' };
    }

    return {
      success: true,
      analysisId: inserted.id,
    };
  } catch (error) {
    console.error('Error in stageBarcodeMealAction:', error);
    return {
      success: false,
      code: getErrorCode(error),
    };
  }
}
