import type { NextRequest } from 'next/server';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { logNutritionLabelMealSchema } from '@/lib/api/contracts/nutrition-label';
import { handleRouteError } from '@/lib/api/respond';
import { stageOcrMeal } from '@/lib/domain/nutrition/ocr/stage';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { mapNutritionLabelError } from '../_errors';

export const runtime = 'nodejs';

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
    const { user } = await requireAuthAndProfile();
    const body = logNutritionLabelMealSchema.parse(await req.json());

    const { analysisId } = await stageOcrMeal(user.id, body);
    const result = await confirmAndSaveMealAction({
      analysisId,
      mealId: body.mealId,
    });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(mapNutritionLabelError(error));
  }
}
