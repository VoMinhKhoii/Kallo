import type { NextRequest } from 'next/server';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { scanNutritionLabelSchema } from '@/lib/api/contracts/nutrition-label';
import { handleRouteError } from '@/lib/api/respond';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { scanWithStoredLabelImage } from '@/lib/domain/nutrition/label-images/label-images';
import { validateNutritionLabelImage } from '@/lib/domain/nutrition/ocr/image';
import { OCR_MAX_BODY_BYTES } from '@/lib/domain/nutrition/ocr/image-constants';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';
import { withOcrGuard } from '@/lib/infra/rate-limit/ocr-guard';
import { mapNutritionLabelError } from '../_errors';

/**
 * `POST /api/v1/nutrition-label/scan` — read a packaged product's Nutrition
 * Facts table out of a photo. Body is `{ imageBase64, mimeType }`; the reply is
 * `{ label: ParsedNutritionLabel, labelImageId?: string }`, the same values
 * the web Server Action `scanNutritionLabelAction` returns.
 *
 * No meal is written: the client reviews and edits the extracted values, then
 * posts them (with `labelImageId`) to the sibling `/log` route. The photo
 * itself is kept in the private `nutrition-labels` bucket, best-effort.
 *
 * A photo with no printed nutrition table is a 422 `OCR_NO_LABEL_DETECTED`
 * envelope — the client offers the barcode scanner or manual entry instead.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth before validation, matching the barcode routes and the wider
    // /api/v1 convention: unauthenticated callers get a 401, not a
    // validation-shaped 400.
    const { user, profile } = await requireAuthAndProfile();

    // Label scanning is premium: the throw is a 402 envelope via
    // `mapNutritionLabelError`'s pass-through default → `handleRouteError`.
    await assertFeatureAccess(
      { userId: user.id, profileCreatedAt: profile.createdAt },
      'label_scan'
    );

    // The per-user slot wraps the WHOLE expensive region: reading a multi-MB
    // base64 body, validating it, the `sharp` decode inside
    // validateNutritionLabelImage, and the Gemini call. Acquiring only around
    // Gemini would leave the decode ungated.
    //
    // `chargeGlobal` charges the app-wide daily budget, and it is called LAST —
    // immediately before the provider request, once we know one is really going
    // to happen. A body that fails its cap or its schema costs the caller a
    // per-user slot and nothing from everybody else's budget.
    //
    // The body is read through `readBoundedJson`, not `req.json()`: an
    // authenticated caller could otherwise make the server buffer an unbounded
    // payload, and the schema's size check only runs after the whole thing has
    // been parsed into memory.
    const scanned = await withOcrGuard(user.id, async (chargeGlobal) => {
      const body = scanNutritionLabelSchema.parse(
        await readBoundedJson(req, OCR_MAX_BODY_BYTES)
      );
      await validateNutritionLabelImage(body);
      await chargeGlobal();
      // The photo is kept best-effort, in parallel with the model call.
      return scanWithStoredLabelImage({ userId: user.id, ...body }, () =>
        scanNutritionLabelWithGemini({
          imageBase64: body.imageBase64,
          mimeType: body.mimeType,
        })
      );
    });
    // `labelImageId` is omitted when the photo could not be kept.
    return Response.json({
      label: scanned.result,
      labelImageId: scanned.labelImageId ?? undefined,
    });
  } catch (error) {
    return handleRouteError(mapNutritionLabelError(error));
  }
}
