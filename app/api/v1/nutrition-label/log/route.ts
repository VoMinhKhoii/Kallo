import { after, type NextRequest } from 'next/server';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { readJsonBody } from '@/lib/api/auth';
import { logNutritionLabelMealSchema } from '@/lib/api/contracts/nutrition-label';
import { handleRouteError } from '@/lib/api/respond';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { linkLabelImageToMeal } from '@/lib/domain/nutrition/label-images/label-images';
import { stageOcrMeal } from '@/lib/domain/nutrition/ocr/stage';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { mapNutritionLabelError } from '../_errors';

/**
 * `POST /api/v1/nutrition-label/log` — stage the user-reviewed values from a
 * scanned label AND confirm them, in one call. The review step is the last
 * user step, so a single round trip is faster and avoids the two-call
 * partial-failure mode. Same shape and reasoning as
 * `POST /api/v1/barcode/log`.
 *
 * Degraded mode: if staging succeeds but confirm throws, the pending analysis
 * row remains and surfaces as a normal pending-confirmation card in the feed —
 * recoverable by the user, never corrupting.
 *
 * Returns the same `ConfirmMealResponse` body as `/api/v1/meals/confirm`.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, profile } = await requireAuthAndProfile();
    const body = logNutritionLabelMealSchema.parse(await readJsonBody(req));

    // Label scanning is premium: the throw is a 402 envelope via
    // `mapNutritionLabelError`'s pass-through default → `handleRouteError`.
    await assertFeatureAccess(
      { userId: user.id, profileCreatedAt: profile.createdAt },
      'label_scan'
    );

    const { analysisId } = await stageOcrMeal(user.id, body);
    const result = await confirmAndSaveMealAction({
      analysisId,
      mealId: body.mealId,
    });
    // Link the kept scan to this meal with the values the user saved — after
    // the response, so saving takes no longer than it did. Best-effort and
    // owner-scoped: an id that is not the caller's is ignored.
    const { labelImageId } = body;
    if (labelImageId) {
      after(() =>
        linkLabelImageToMeal(user.id, labelImageId, result.mealId, body)
      );
    }
    return Response.json(result);
  } catch (error) {
    return handleRouteError(mapNutritionLabelError(error));
  }
}
