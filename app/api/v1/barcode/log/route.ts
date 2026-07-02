import type { NextRequest } from 'next/server';
import { confirmAndSaveMealAction } from '@/lib/actions/meals';
import { logBarcodeMealSchema } from '@/lib/api/contracts/barcode';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import { stageBarcodeMeal } from '@/lib/barcode/service';
import { mapBarcodeServiceError } from '../_errors';

export const runtime = 'nodejs';

/**
 * `POST /api/v1/barcode/log` — stage a previously searched barcode product at
 * the given grams AND confirm it, in one call. The barcode flow has no user
 * step between stage and confirm (the web dialog calls the two actions
 * back-to-back), so a single round trip is faster and avoids the two-call
 * partial-failure mode.
 *
 * Degraded mode: if staging succeeds but confirm throws, the pending analysis
 * row remains and surfaces as a normal pending-confirmation card in the feed —
 * recoverable by the user, never corrupting.
 *
 * Returns the same `ConfirmMealResponse` body as `/api/v1/meals/confirm`.
 * A barcode that was never searched (nothing cached to stage from) is a 404
 * `BARCODE_NOT_CACHED` envelope — the client prompts a rescan.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth before validation, matching the sibling search route and the
    // wider /api/v1 convention: unauthenticated callers get a 401, not a
    // validation-shaped 400.
    const { user } = await requireAuthAndProfile();
    const body = logBarcodeMealSchema.parse(await req.json());

    const { analysisId } = await stageBarcodeMeal(user.id, body);
    const result = await confirmAndSaveMealAction({
      analysisId,
      mealId: body.mealId,
    });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(mapBarcodeServiceError(error));
  }
}
