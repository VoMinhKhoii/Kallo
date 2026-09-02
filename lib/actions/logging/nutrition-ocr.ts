'use server';

import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import {
  logNutritionLabelMealSchema,
  scanNutritionLabelSchema,
} from '@/lib/api/contracts/nutrition-label';
import { checkFeatureGate } from '@/lib/domain/billing/feature-gate';
import { scanErrorCode } from '@/lib/domain/nutrition/ocr/error';
import {
  NutritionOcrImageError,
  validateNutritionLabelImage,
} from '@/lib/domain/nutrition/ocr/image';
import { OCR_MAX_IMAGE_BASE64_CHARS } from '@/lib/domain/nutrition/ocr/image-constants';
import type {
  OcrErrorCode,
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import { stageOcrMeal } from '@/lib/domain/nutrition/ocr/stage';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { withOcrGuard } from '@/lib/infra/rate-limit/ocr-guard';

/**
 * Validate the scan input INSIDE the guard, cheapest check first.
 *
 * Order is deliberate. The schema's base64 refinement runs
 * `/^[A-Za-z0-9+\/]+={0,2}$/` over the whole string, so on a 6 MiB payload the
 * validation itself is the CPU cost — and it used to run BEFORE `requireAuth`,
 * making an unauthenticated caller able to spend it. A `length` comparison
 * rejects anything past the byte cap first; only what could plausibly be a
 * legal image pays for the regex.
 *
 * A refusal is thrown as `NutritionOcrImageError` rather than returned so the
 * caller's single `scanErrorCode` fold keeps producing `invalid_image`, exactly
 * as the previous `safeParse` early-return did.
 */
function parseScanInput(input: { imageBase64: string; mimeType: string }) {
  if (
    typeof input.imageBase64 !== 'string' ||
    input.imageBase64.length > OCR_MAX_IMAGE_BASE64_CHARS
  ) {
    throw new NutritionOcrImageError('Image payload is too large');
  }

  const parsed = scanNutritionLabelSchema.safeParse(input);
  if (!parsed.success) {
    throw new NutritionOcrImageError('Malformed nutrition-label scan input');
  }

  return parsed.data;
}

export async function scanNutritionLabelAction(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<
  | { success: true; data: ParsedNutritionLabel }
  | { success: false; code: OcrErrorCode }
> {
  try {
    // Authenticate FIRST. Validation is not free here (see `parseScanInput`),
    // and work an anonymous caller can make the server do is work that needs no
    // account to abuse.
    const { user, profile } = await requireAuthAndProfile();
    // Label scanning is premium. Returned as a code, never thrown: `scanErrorCode`
    // would classify a thrown FeatureLockedError as `server_error`.
    const gate = await checkFeatureGate(
      { userId: user.id, profileCreatedAt: profile.createdAt },
      'label_scan'
    );
    if (gate.locked) return { success: false, code: 'feature_locked' };

    // Same per-user slot as the mobile route, wrapping validation, the `sharp`
    // decode and the Gemini call; `chargeGlobal` charges the app-wide daily
    // budget last, once a provider call is actually about to happen. A block
    // throws `RateLimitedError` (429), which `scanErrorCode` folds into the
    // `rate_limited` code below.
    const data = await withOcrGuard(user.id, async (chargeGlobal) => {
      const parsed = parseScanInput(input);
      await validateNutritionLabelImage(parsed);
      await chargeGlobal();
      return scanNutritionLabelWithGemini({
        imageBase64: parsed.imageBase64,
        mimeType: parsed.mimeType,
      });
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
