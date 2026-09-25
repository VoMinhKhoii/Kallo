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
 * Keeping a scan is BEST-EFFORT and invisible to the caller: the upload runs
 * in parallel with the model call, the row is written after the outcome is
 * known and after the response (`after()`), and nothing here can change the
 * scan's reply, status or latency.
 */
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
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
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';
import { db } from '@/lib/infra/db/client';
import { nutritionLabelImages } from '@/lib/infra/db/schema';
import { createAdminClient } from '@/lib/infra/supabase/admin';

/** Let the post-response writes outlive the reply. `after()` throws outside
 *  a request scope; the promise keeps running regardless. */
function keepAlive(pending: Promise<unknown>): void {
  try {
    after(pending);
  } catch {
    // No request scope (a script or a unit test): nothing to extend.
  }
}

/**
 * Run `scan` (the model call) while its photo is kept alongside it. Call it
 * after every gate — validation, the spend guard's global charge, consent —
 * so a refused request stores nothing.
 *
 * The scan's result or error passes through untouched. The model call is
 * dispatched first and the upload runs alongside it. `labelImageId` is the
 * kept scan's id when the upload had already finished by the time the model
 * answered (the normal case: a storage PUT is far quicker than a vision
 * call); otherwise null, rather than waiting for it. The row itself is
 * written after the response.
 */
export async function scanWithStoredLabelImage(
  input: LabelImageInput,
  scan: () => Promise<ParsedNutritionLabel>
): Promise<{ result: ParsedNutritionLabel; labelImageId: string | null }> {
  const startedAt = Date.now();
  const scanning = scan();

  const imageId = randomUUID();
  let uploaded = false;
  const upload = uploadLabelImage(input, imageId).then((stored) => {
    uploaded = stored;
    return stored;
  });
  const record = (outcome: ScanOutcome) =>
    keepAlive(
      upload.then((stored) =>
        stored ? insertScanRow(input, imageId, outcome) : undefined
      )
    );

  let result: ParsedNutritionLabel;
  try {
    result = await scanning;
  } catch (error) {
    record({
      status: 'failed',
      errorCode: scanFailureCode(error),
      latencyMs: Date.now() - startedAt,
    });
    throw error;
  }
  record({ status: 'succeeded', result, latencyMs: Date.now() - startedAt });
  return { result, labelImageId: uploaded ? imageId : null };
}

/**
 * Link the caller's own kept scan to the meal it was logged as, with the
 * values the user saved (model output vs user correction is the eval
 * signal). Scoped to `userId`, so an id that is not theirs matches no row and
 * is ignored. Best-effort: the meal is already saved, so a failure only logs.
 */
export async function linkLabelImageToMeal(
  userId: string,
  imageId: string,
  mealId: string,
  reviewed: LogNutritionLabelMealInput
): Promise<void> {
  const {
    labelImageId: _labelImageId,
    mealId: _mealId,
    ...reviewedResult
  } = reviewed;
  try {
    await db
      .update(nutritionLabelImages)
      .set({ mealId, reviewedResult })
      .where(
        and(
          eq(nutritionLabelImages.id, imageId),
          eq(nutritionLabelImages.userId, userId)
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
