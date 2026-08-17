import type { NextRequest } from 'next/server';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr';
import { scanNutritionLabelSchema } from '@/lib/api/contracts/nutrition-label';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import { validateNutritionLabelImage } from '@/lib/nutrition/ocr-image';
import { mapNutritionLabelError } from '../_errors';

// `sharp` decodes the image in validateNutritionLabelImage — Node runtime only.
export const runtime = 'nodejs';

/**
 * `POST /api/v1/nutrition-label/scan` — read a packaged product's Nutrition
 * Facts table out of a photo. Body is `{ imageBase64, mimeType }`; the reply is
 * `{ label: ParsedNutritionLabel }`, the same value the web Server Action
 * `scanNutritionLabelAction` returns.
 *
 * Nothing is written: the client reviews and edits the extracted values, then
 * posts them to the sibling `/log` route.
 *
 * A photo with no printed nutrition table is a 422 `OCR_NO_LABEL_DETECTED`
 * envelope — the client offers the barcode scanner or manual entry instead.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth before validation, matching the barcode routes and the wider
    // /api/v1 convention: unauthenticated callers get a 401, not a
    // validation-shaped 400.
    await requireAuthAndProfile();
    const body = scanNutritionLabelSchema.parse(await req.json());

    // TODO(rate-limit): Enforce the per-user OCR limit here and throw an error with code "rate_limited".
    await validateNutritionLabelImage(body);

    const label = await scanNutritionLabelWithGemini({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
    });
    return Response.json({ label });
  } catch (error) {
    return handleRouteError(mapNutritionLabelError(error));
  }
}
