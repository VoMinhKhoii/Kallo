/**
 * The two writes behind a kept scan — the photo upload and the outcome row —
 * and the failure classification the row stores. Folder-private: callers go
 * through `label-images.ts`. Neither write ever rejects: keeping a scan is
 * best-effort, so every failure is logged and swallowed here.
 */
import { NUTRITION_LABEL_OCR_MODEL } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { AppError } from '@/lib/core/errors/app-error';
import {
  labelImagePath,
  NUTRITION_LABEL_BUCKET,
} from '@/lib/domain/nutrition/label-images/bucket';
import { scanErrorCode } from '@/lib/domain/nutrition/ocr/error';
import type { OcrImageMimeType } from '@/lib/domain/nutrition/ocr/image-constants';
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';
import { db } from '@/lib/infra/db/client';
import { nutritionLabelImages } from '@/lib/infra/db/schema';
import { createAdminClient } from '@/lib/infra/supabase/admin';

export interface LabelImageInput {
  userId: string;
  /** Already validated by `validateNutritionLabelImage`. */
  imageBase64: string;
  mimeType: OcrImageMimeType;
}

/** How the model call ended, as the row records it. */
export type ScanOutcome =
  | { status: 'succeeded'; result: ParsedNutritionLabel; latencyMs: number }
  | { status: 'failed'; errorCode: string; latencyMs: number };

/**
 * The code a failed scan is stored under. Finer than `scanErrorCode` (which
 * folds everything unrecognised into `server_error` for the client) because
 * the eval set wants to tell a timeout from a malformed model reply.
 */
export function scanFailureCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout';
  if (name === 'ZodError') return 'invalid_model_output';
  return scanErrorCode(error);
}

/** Put the photo at `{userId}/{imageId}.{ext}`; true once it is stored. */
export async function uploadLabelImage(
  input: LabelImageInput,
  imageId: string
): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .storage.from(NUTRITION_LABEL_BUCKET)
      .upload(
        labelImagePath(input.userId, imageId, input.mimeType),
        Buffer.from(input.imageBase64, 'base64'),
        { contentType: input.mimeType, upsert: false }
      );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[label-images] Uploading the scanned label failed:', error);
    return false;
  }
}

/**
 * Record the scan next to its uploaded photo. A failed insert leaves the
 * object under the user's prefix, where account deletion still purges it.
 */
export async function insertScanRow(
  input: LabelImageInput,
  imageId: string,
  outcome: ScanOutcome
): Promise<void> {
  try {
    await db.insert(nutritionLabelImages).values({
      id: imageId,
      userId: input.userId,
      storagePath: labelImagePath(input.userId, imageId, input.mimeType),
      mimeType: input.mimeType,
      byteSize: Buffer.byteLength(input.imageBase64, 'base64'),
      status: outcome.status,
      result: outcome.status === 'succeeded' ? outcome.result : null,
      errorCode: outcome.status === 'failed' ? outcome.errorCode : null,
      model: NUTRITION_LABEL_OCR_MODEL,
      latencyMs: outcome.latencyMs,
    });
  } catch (error) {
    console.error('[label-images] Recording the scanned label failed:', error);
  }
}
