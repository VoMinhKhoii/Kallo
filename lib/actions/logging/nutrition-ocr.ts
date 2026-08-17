'use server';

import { z } from 'zod';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { PipelineResult } from '@/lib/ai/types/result';
import { requireAuthAndProfile } from '@/lib/auth/session';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { pendingAnalyses } from '@/lib/db/schema';
import { validateNutritionLabelImage } from '@/lib/nutrition/ocr-image';
import {
  OCR_MAX_IMAGE_BYTES,
  OCR_UPLOAD_MIME_TYPES,
} from '@/lib/nutrition/ocr-image-constants';
import type {
  OcrErrorCode,
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';
import {
  nutritionValuesSchema,
  ocrConfidenceSchema,
} from '@/lib/nutrition/ocr-schema';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/validation/primitives';

const scanLabelSchema = z.object({
  imageBase64: z
    .string()
    .min(1, 'Image data is required')
    .refine(
      (value) => value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value),
      'Malformed base64 image data'
    )
    .refine((value) => {
      const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
      return (value.length * 3) / 4 - padding <= OCR_MAX_IMAGE_BYTES;
    }, 'Image payload is too large'),
  mimeType: z.enum(OCR_UPLOAD_MIME_TYPES),
});

const stageOcrMealSchema = z.object({
  productName: z.string().min(1).max(200),
  amount: z.number().finite().positive().max(100_000),
  unit: z.enum(['g', 'ml', 'serving']),
  confidence: ocrConfidenceSchema,
  ...nutritionValuesSchema.shape,
  calories: nutritionValuesSchema.shape.calories.unwrap(),
  proteinGrams: nutritionValuesSchema.shape.proteinGrams.unwrap(),
  carbsGrams: nutritionValuesSchema.shape.carbsGrams.unwrap(),
  fatGrams: nutritionValuesSchema.shape.fatGrams.unwrap(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

function scanErrorCode(error: unknown): OcrErrorCode {
  const providerError = error as {
    code?: unknown;
    status?: unknown;
  } | null;
  const code = providerError?.code;
  if (providerError?.status === 429) return 'rate_limited';
  if (
    code === 'invalid_image' ||
    code === 'no_label_detected' ||
    code === 'rate_limited'
  ) {
    return code;
  }
  return 'server_error';
}

export async function scanNutritionLabelAction(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<
  | { success: true; data: ParsedNutritionLabel }
  | { success: false; code: OcrErrorCode }
> {
  const parsed = scanLabelSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: 'invalid_image' };

  try {
    await requireAuthAndProfile();
    // TODO(rate-limit): Enforce the per-user OCR limit here and throw an error with code "rate_limited".
    await validateNutritionLabelImage(parsed.data);

    const data = await scanNutritionLabelWithGemini({
      imageBase64: parsed.data.imageBase64,
      mimeType: parsed.data.mimeType,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error in scanNutritionLabelAction:', error);
    return { success: false, code: scanErrorCode(error) };
  }
}

export async function stageOcrMealAction(
  input: OcrReviewPayload & {
    loggedDate: string;
    timezoneOffset: number;
  }
): Promise<
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
      magnesiumMg: parsed.magnesiumMg ?? null,
      phosphorusMg: parsed.phosphorusMg ?? null,
      potassiumMg: parsed.potassiumMg ?? null,
      zincMg: parsed.zincMg ?? null,
      copperMcg: parsed.copperMcg ?? null,
      manganeseMg: parsed.manganeseMg ?? null,
      betaCaroteneMcg: parsed.betaCaroteneMcg ?? null,
      vitaminAMcg: parsed.vitaminAMcg ?? null,
      vitaminCMg: parsed.vitaminCMg ?? null,
      vitaminDMcg: parsed.vitaminDMcg ?? null,
      vitaminEMg: parsed.vitaminEMg ?? null,
      vitaminKMcg: parsed.vitaminKMcg ?? null,
      vitaminB1Mg: parsed.vitaminB1Mg ?? null,
      vitaminB2Mg: parsed.vitaminB2Mg ?? null,
      vitaminPpMg: parsed.vitaminPpMg ?? null,
      vitaminB5Mg: parsed.vitaminB5Mg ?? null,
      vitaminB6Mg: parsed.vitaminB6Mg ?? null,
      vitaminB9Mcg: parsed.vitaminB9Mcg ?? null,
      vitaminB12Mcg: parsed.vitaminB12Mcg ?? null,
      vitaminHMcg: parsed.vitaminHMcg ?? null,
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
      confidenceOverall: parsed.confidence,
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
              estimatedGrams: parsed.amount,
              rawEquivalentGrams: parsed.amount,
              cookingMethod: null,
              userFacingUnit: parsed.unit,
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
        rawInput: `${parsed.productName} (${parsed.amount}${parsed.unit})`,
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
