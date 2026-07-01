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

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return issue ? issue.message : 'Dữ liệu đầu vào không hợp lệ.';
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi hệ thống.';
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
  | { success: false; error: string }
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
        },
      };
    }

    // 2. Fetch from Open Food Facts
    const product = await fetchProductFromOpenFoodFacts(parsed.barcode);
    if (!product) {
      return {
        success: false,
        error: 'Không tìm thấy sản phẩm với mã vạch này.',
      };
    }

    // 3. Cache in Database
    const [sourceRow] = await db
      .select({ id: ingredientSources.id })
      .from(ingredientSources)
      .where(eq(ingredientSources.code, 'OFF'))
      .limit(1);

    const sourceId = sourceRow ? sourceRow.id : 1;
    const namePrimary = product.brand
      ? `[${product.brand}] ${product.name}`
      : product.name;

    await db.insert(vietnameseFoodComposition).values({
      id: dbId,
      namePrimary,
      nameEn: product.name,
      typeVn: 'Sản phẩm đóng gói',
      typeEn: 'Packaged product',
      sourceId,
      state: 'cooked',
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
    });

    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error('Error in searchBarcodeAction:', error);
    return {
      success: false,
      error: getErrorMessage(error),
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
  { success: true; analysisId: string } | { success: false; error: string }
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
      return {
        success: false,
        error: 'Sản phẩm chưa được lưu hoặc không tồn tại.',
      };
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
      return {
        success: false,
        error: 'Không thể thêm phân tích chờ duyệt.',
      };
    }

    return {
      success: true,
      analysisId: inserted.id,
    };
  } catch (error) {
    console.error('Error in stageBarcodeMealAction:', error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
