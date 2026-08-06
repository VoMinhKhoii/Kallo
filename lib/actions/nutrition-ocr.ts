'use server';

import { z } from 'zod';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr';
import type {
  BoundedNutrition,
  NutritionValues,
  PipelineResult,
} from '@/lib/ai/types';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { pendingAnalyses } from '@/lib/db/schema';
import type {
  OcrErrorCode,
  ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

const scanLabelSchema = z.object({
  imageBase64: z.string().min(1, 'Image data is required'),
  mimeType: z
    .string()
    .refine(
      (val) =>
        [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif',
          'image/gif',
          'image/bmp',
        ].includes(val),
      'Unsupported image format'
    ),
});

const stageOcrMealSchema = z.object({
  productName: z.string().min(1).max(200),
  grams: z.number().positive().max(10_000),
  calories: z.number().nonnegative(),
  proteinGrams: z.number().nonnegative(),
  carbsGrams: z.number().nonnegative(),
  fatGrams: z.number().nonnegative(),
  fiberGrams: z.number().nullable().optional(),
  sodiumMg: z.number().nullable().optional(),
  calciumMg: z.number().nullable().optional(),
  ironMg: z.number().nullable().optional(),
  potassiumMg: z.number().nullable().optional(),
  vitaminAMcg: z.number().nullable().optional(),
  vitaminCMg: z.number().nullable().optional(),
  vitaminDMcg: z.number().nullable().optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export async function scanNutritionLabelAction(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<
  | { success: true; data: ParsedNutritionLabel }
  | { success: false; code: OcrErrorCode }
> {
  try {
    const parsed = scanLabelSchema.parse(input);
    await requireAuthAndProfile();

    const data = await scanNutritionLabelWithGemini({
      imageBase64: parsed.imageBase64,
      mimeType: parsed.mimeType,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error in scanNutritionLabelAction:', error);
    if (error instanceof z.ZodError) {
      return { success: false, code: 'invalid_image' };
    }
    return { success: false, code: 'server_error' };
  }
}

export async function stageOcrMealAction(input: {
  productName: string;
  grams: number;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams?: number | null;
  sodiumMg?: number | null;
  calciumMg?: number | null;
  ironMg?: number | null;
  potassiumMg?: number | null;
  vitaminAMcg?: number | null;
  vitaminCMg?: number | null;
  vitaminDMcg?: number | null;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<
  { success: true; analysisId: string } | { success: false; code: OcrErrorCode }
> {
  try {
    const parsed = stageOcrMealSchema.parse(input);
    const { user } = await requireAuthAndProfile();

    const nutrition: NutritionValues = {
      caloriesKcal: parsed.calories,
      proteinG: parsed.proteinGrams,
      carbohydrateG: parsed.carbsGrams,
      fatG: parsed.fatGrams,
      fiberG: parsed.fiberGrams ?? null,
      sodiumMg: parsed.sodiumMg ?? null,
      calciumMg: parsed.calciumMg ?? null,
      ironMg: parsed.ironMg ?? null,
      potassiumMg: parsed.potassiumMg ?? null,
      vitaminAMcg: parsed.vitaminAMcg ?? null,
      vitaminCMg: parsed.vitaminCMg ?? null,
      vitaminDMcg: parsed.vitaminDMcg ?? null,
      magnesiumMg: null,
      phosphorusMg: null,
      zincMg: null,
      copperMcg: null,
      manganeseMg: null,
      betaCaroteneMcg: null,
      vitaminEMg: null,
      vitaminKMcg: null,
      vitaminB1Mg: null,
      vitaminB2Mg: null,
      vitaminPpMg: null,
      vitaminB5Mg: null,
      vitaminB6Mg: null,
      vitaminB9Mcg: null,
      vitaminB12Mcg: null,
      vitaminHMcg: null,
    };

    const bounded: BoundedNutrition = {} as BoundedNutrition;
    for (const key of NUTRITION_KEYS) {
      const val = nutrition[key];
      bounded[key] = val !== null ? { low: val, mid: val, high: val } : null;
    }

    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );

    const pipelineResult: PipelineResult = {
      mealSlot: null,
      confidenceOverall: 'high',
      unmatchedIngredients: [],
      displayedNutrition: nutrition,
      boundedNutrition: bounded,
      mealItems: [
        {
          name: parsed.productName,
          displayedNutrition: nutrition,
          boundedNutrition: bounded,
          ingredients: [
            {
              ingredientName: parsed.productName,
              foodCompositionId: null,
              estimatedGrams: parsed.grams,
              rawEquivalentGrams: parsed.grams,
              cookingMethod: null,
              userFacingUnit: 'g',
              matchConfidence: 1,
              boundedNutrition: bounded,
              displayedNutrition: nutrition,
            },
          ],
        },
      ],
    };

    const [inserted] = await db
      .insert(pendingAnalyses)
      .values({
        userId: user.id,
        pipelineResult,
        rawInput: `${parsed.productName} (${parsed.grams}g)`,
        entryMode: 'precise',
        loggedAt,
      })
      .returning({ id: pendingAnalyses.id });

    if (!inserted) {
      return { success: false, code: 'server_error' };
    }

    return { success: true, analysisId: inserted.id };
  } catch (error) {
    console.error('Error in stageOcrMealAction:', error);
    return { success: false, code: 'server_error' };
  }
}
