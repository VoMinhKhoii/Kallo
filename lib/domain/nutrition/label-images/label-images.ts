/**
 * Kept nutrition-label scans: every photo the label scanner sends to the
 * model is kept privately with the scan's outcome — the future OCR eval set.
 *
 * Product decision: the photo sits in the PRIVATE `nutrition-labels` bucket
 * and its row in `nutrition_label_images` records what the model returned
 * (or how it failed) and, once logged, what the user saved. Readers: the
 * owner (a signed URL to their own photo) and the team through the service
 * role. No other user can read one. Retained until the account is deleted.
 *
 * Shared by both scan entry points — `POST /api/v1/nutrition-label/scan` and
 * the web `scanNutritionLabelAction` — plus the log route (linking the scan to
 * the saved meal) and the owner's signed-URL route.
 *
 * Keeping a scan is BEST-EFFORT and invisible to the caller: the photo is
 * stripped of its metadata and uploaded in parallel with the model call, and
 * nothing here can change the scan's reply or status. The only latency it
 * adds is the row insert, awaited when the upload has already finished by the
 * time the model answers: a few ms, as slow as any other query of the request
 * only when the database is (plus the photo's removal if the insert fails).
 * Otherwise the row is written after the response (`after()`).
 */
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { after } from 'next/server';
import type {
  LabelImageUrl,
  LogNutritionLabelMealInput,
} from '@/lib/api/contracts/nutrition-label';
import { Errors } from '@/lib/core/errors/catalog';
import {
  LABEL_IMAGE_URL_TTL_SECONDS,
  NUTRITION_LABEL_BUCKET,
} from '@/lib/domain/nutrition/label-images/bucket';
import {
  insertScanRow,
  type LabelImageInput,
  type ScanOutcome,
  scanFailureCode,
  uploadLabelImage,
} from '@/lib/domain/nutrition/label-images/record-scan';
import {
  OCR_NUTRIENT_KEYS,
  type ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import { db } from '@/lib/infra/db/client';
import { nutritionLabelImages } from '@/lib/infra/db/schema';
import { createAdminClient } from '@/lib/infra/supabase/admin';

/** The private bucket kept label photos live in (account deletion purges
 *  the owner's prefix; the data export lists its objects). */
export { NUTRITION_LABEL_BUCKET };

/** Let the post-response writes outlive the reply. `after()` throws outside
 *  a request scope; the promise keeps running regardless. */
function keepAlive(pending: Promise<unknown>): void {
  try {
    after(pending);
  } catch {
    // No request scope (a script or a unit test): nothing to extend.
  }
}

/** Race sentinel: the upload had not settled when the model answered. */
const STILL_UPLOADING = Symbol('still-uploading');

/**
 * Run `scan` (the model call) while its photo is kept alongside it. Call it
 * after every gate — validation, the spend guard's global charge, consent —
 * so a refused request stores nothing.
 *
 * The scan's result or error passes through untouched. The model call is
 * dispatched first and the upload runs alongside it. When the model answers:
 *   - upload already finished (the normal case: a storage PUT is far quicker
 *     than a vision call) → the row is inserted inline, and `labelImageId` is
 *     returned only if that insert succeeded, so the id always names a row;
 *   - upload still running → no id, rather than waiting for it; the row is
 *     written after the response once the upload settles;
 *   - upload failed → no id, nothing to record.
 * A failed insert removes the photo (`insertScanRow`). A failed scan's row is
 * always written after the response.
 */
export async function scanWithStoredLabelImage(
  input: LabelImageInput,
  scan: () => Promise<ParsedNutritionLabel>
): Promise<{ result: ParsedNutritionLabel; labelImageId: string | null }> {
  const startedAt = Date.now();
  const scanning = scan();
  const upload = uploadLabelImage(input, randomUUID());
  const recordLater = (outcome: ScanOutcome) =>
    keepAlive(
      upload.then((stored) =>
        stored ? insertScanRow(stored, outcome) : undefined
      )
    );

  let result: ParsedNutritionLabel;
  try {
    result = await scanning;
  } catch (error) {
    recordLater({
      status: 'failed',
      errorCode: scanFailureCode(error),
      latencyMs: Date.now() - startedAt,
    });
    throw error;
  }
  const outcome: ScanOutcome = {
    status: 'succeeded',
    result,
    latencyMs: Date.now() - startedAt,
  };

  // Peek without waiting: an already-settled `upload` wins the race because
  // it is listed first.
  const settled = await Promise.race([
    upload,
    Promise.resolve(STILL_UPLOADING),
  ]);
  if (settled === STILL_UPLOADING) {
    recordLater(outcome);
    return { result, labelImageId: null };
  }
  if (!settled) return { result, labelImageId: null };
  const recorded = await insertScanRow(settled, outcome);
  return { result, labelImageId: recorded ? settled.imageId : null };
}

/**
 * The part of a `/log` body the user reviewed: product, serving and the
 * nutrients. Model confidence, the diary day, the timezone and the ids are
 * not the correction, so they are left out.
 */
function reviewedCorrection(
  reviewed: LogNutritionLabelMealInput
): Record<string, unknown> {
  const correction: Record<string, unknown> = {
    productName: reviewed.productName,
    amount: reviewed.amount,
    unit: reviewed.unit,
  };
  for (const key of OCR_NUTRIENT_KEYS) {
    if (reviewed[key] !== undefined) correction[key] = reviewed[key];
  }
  return correction;
}

/**
 * Link the caller's own kept scan to the meal it was logged as, with the
 * user's correction (model output vs user correction is the eval signal).
 * Scoped to `userId`, so an id that is not theirs matches no row and is
 * ignored; and only an unlinked scan is linked, so a replayed `/log` cannot
 * re-point it. Best-effort: the meal is already saved, so a failure only logs.
 */
export async function linkLabelImageToMeal(
  userId: string,
  imageId: string,
  mealId: string,
  reviewed: LogNutritionLabelMealInput
): Promise<void> {
  try {
    await db
      .update(nutritionLabelImages)
      .set({ mealId, reviewedResult: reviewedCorrection(reviewed) })
      .where(
        and(
          eq(nutritionLabelImages.id, imageId),
          eq(nutritionLabelImages.userId, userId),
          isNull(nutritionLabelImages.mealId)
        )
      );
  } catch (error) {
    console.error(
      '[label-images] Linking the label to its meal failed:',
      error
    );
  }
}

/**
 * A short-lived signed URL for the owner's own photo. Someone else's id, or
 * one that does not exist, is the same 404.
 */
export async function createLabelImageUrl(
  userId: string,
  imageId: string
): Promise<LabelImageUrl> {
  const [row] = await db
    .select({ storagePath: nutritionLabelImages.storagePath })
    .from(nutritionLabelImages)
    .where(
      and(
        eq(nutritionLabelImages.id, imageId),
        eq(nutritionLabelImages.userId, userId)
      )
    )
    .limit(1);
  if (!row) throw Errors.notFound('Nutrition label image not found.');

  // Stamped before the request, so the reported expiry is never later than
  // the real one.
  const expiresAt = new Date(Date.now() + LABEL_IMAGE_URL_TTL_SECONDS * 1000);
  const { data, error } = await createAdminClient()
    .storage.from(NUTRITION_LABEL_BUCKET)
    .createSignedUrl(row.storagePath, LABEL_IMAGE_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw Errors.internal(error, 'Could not open the label photo.');
  }
  return { url: data.signedUrl, expiresAt: expiresAt.toISOString() };
}
