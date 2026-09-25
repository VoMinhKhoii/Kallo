/**
 * The two writes behind a kept scan — the photo upload and the outcome row —
 * and the failure classification the row stores. Folder-private: callers go
 * through `label-images.ts`. Neither write ever rejects: keeping a scan is
 * best-effort, so every failure is logged and swallowed here.
 */
import sharp from 'sharp';
import { NUTRITION_LABEL_OCR_MODEL } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { AppError } from '@/lib/core/errors/app-error';
import {
  labelImagePath,
  NUTRITION_LABEL_BUCKET,
} from '@/lib/domain/nutrition/label-images/bucket';
import { scanErrorCode } from '@/lib/domain/nutrition/ocr/error';
import {
  OCR_MAX_IMAGE_PIXELS,
  type OcrImageMimeType,
} from '@/lib/domain/nutrition/ocr/image-constants';
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

/** The object actually written to the bucket: the re-encoded photo. */
export interface StoredLabelImage {
  userId: string;
  imageId: string;
  storagePath: string;
  mimeType: OcrImageMimeType;
  byteSize: number;
}

/** How the model call ended, as the row records it. */
export type ScanOutcome =
  | { status: 'succeeded'; result: ParsedNutritionLabel; latencyMs: number }
  | { status: 'failed'; errorCode: string; latencyMs: number };

const MIME_BY_FORMAT: Record<string, OcrImageMimeType> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

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

/**
 * Re-encode in the same format, applying the EXIF orientation. sharp drops
 * all metadata (EXIF incl. GPS, XMP, IPTC) unless asked to keep it, so the
 * stored photo carries no location or device data from the client's bytes.
 */
async function stripMetadata(
  input: LabelImageInput
): Promise<{ bytes: Buffer; mimeType: OcrImageMimeType }> {
  const { data, info } = await sharp(Buffer.from(input.imageBase64, 'base64'), {
    limitInputPixels: OCR_MAX_IMAGE_PIXELS,
  })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const mimeType = MIME_BY_FORMAT[info.format];
  if (!mimeType) throw new Error(`Unexpected re-encoded format ${info.format}`);
  return { bytes: data, mimeType };
}

/**
 * Store the photo, without its metadata, at `{userId}/{imageId}.{ext}`.
 * Returns what was stored, or null when nothing was (the original bytes are
 * never uploaded as a fallback).
 */
export async function uploadLabelImage(
  input: LabelImageInput,
  imageId: string
): Promise<StoredLabelImage | null> {
  try {
    const { bytes, mimeType } = await stripMetadata(input);
    const storagePath = labelImagePath(input.userId, imageId, mimeType);
    const { error } = await createAdminClient()
      .storage.from(NUTRITION_LABEL_BUCKET)
      .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (error) throw error;
    return {
      userId: input.userId,
      imageId,
      storagePath,
      mimeType,
      byteSize: bytes.byteLength,
    };
  } catch (error) {
    console.error('[label-images] Uploading the scanned label failed:', error);
    return null;
  }
}

/**
 * Best-effort delete of a stored photo whose row could not be written, so
 * the bucket never holds a photo the export, the eval set and the owner's
 * `/images` route cannot see. This also covers a scan that lands after
 * account deletion purged the prefix: its insert fails on the user FK.
 */
async function removeOrphanedImage(stored: StoredLabelImage): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .storage.from(NUTRITION_LABEL_BUCKET)
      .remove([stored.storagePath]);
    if (error) throw error;
  } catch (error) {
    console.error(
      '[label-images] Removing a label photo without a row failed:',
      stored.storagePath,
      error
    );
  }
}

/**
 * Record the scan next to its stored photo; true once the row exists. When
 * the insert fails the photo is removed, so the two never diverge.
 */
export async function insertScanRow(
  stored: StoredLabelImage,
  outcome: ScanOutcome
): Promise<boolean> {
  try {
    await db.insert(nutritionLabelImages).values({
      id: stored.imageId,
      userId: stored.userId,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      status: outcome.status,
      result: outcome.status === 'succeeded' ? outcome.result : null,
      errorCode: outcome.status === 'failed' ? outcome.errorCode : null,
      model: NUTRITION_LABEL_OCR_MODEL,
      latencyMs: outcome.latencyMs,
    });
    return true;
  } catch (error) {
    console.error('[label-images] Recording the scanned label failed:', error);
    await removeOrphanedImage(stored);
    return false;
  }
}
