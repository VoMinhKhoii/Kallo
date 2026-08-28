'use server';

import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import {
  logNutritionLabelMealSchema,
  scanNutritionLabelSchema,
} from '@/lib/api/contracts/nutrition-label';
import { checkFeatureGate } from '@/lib/domain/billing/feature-gate';
import { scanErrorCode } from '@/lib/domain/nutrition/ocr/error';
import { validateNutritionLabelImage } from '@/lib/domain/nutrition/ocr/image';
import type {
  OcrErrorCode,
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import { stageOcrMeal } from '@/lib/domain/nutrition/ocr/stage';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export async function scanNutritionLabelAction(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<
  | { success: true; data: ParsedNutritionLabel }
  | { success: false; code: OcrErrorCode }
> {
  const parsed = scanNutritionLabelSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: 'invalid_image' };

  try {
    const { user, profile } = await requireAuthAndProfile();
    // Label scanning is premium. Returned as a code, never thrown: `scanErrorCode`
    // would classify a thrown FeatureLockedError as `server_error`.
    const gate = await checkFeatureGate(
      { userId: user.id, profileCreatedAt: profile.createdAt },
      'label_scan'
    );
    if (gate.locked) return { success: false, code: 'feature_locked' };
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
    const parsed = logNutritionLabelMealSchema.parse(input);
    const { user, profile } = await requireAuthAndProfile();
    // Same premium gate as the scan step, same return-don't-throw reasoning.
    const gate = await checkFeatureGate(
      { userId: user.id, profileCreatedAt: profile.createdAt },
      'label_scan'
    );
    if (gate.locked) return { success: false, code: 'feature_locked' };

    return { success: true, ...(await stageOcrMeal(user.id, parsed)) };
  } catch (error) {
    console.error('Error in stageOcrMealAction:', error);
    return { success: false, code: 'server_error' };
  }
}
