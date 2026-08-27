import type { NextRequest } from 'next/server';
import { discardPendingAnalysisAction } from '@/lib/actions/meals/mutate-meal';
import { discardPendingSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/**
 * Throw away a staged analysis. The id lives in the path, not a body, so this
 * reads like `meals/[mealId]` — the other identified-resource DELETE — rather
 * than like the collection GET next door.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const parsed = discardPendingSchema.parse(await params);
    const result = await discardPendingAnalysisAction(parsed);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
