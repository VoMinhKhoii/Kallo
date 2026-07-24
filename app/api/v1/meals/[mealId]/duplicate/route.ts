import type { NextRequest } from 'next/server';
import { duplicateMealAction } from '@/lib/actions/meals/duplicate-meal';
import { duplicateMealBodySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/**
 * "Log again": duplicate a saved meal verbatim onto the chosen day (a
 * deterministic server-side copy of its item rows — no AI re-run). The source
 * `mealId` comes from the URL path, never the request body: `duplicateMealAction`
 * loads it scoped to the authenticated user (userId-scoped lookup, mirroring the
 * DELETE/PATCH guards) before copying, so a caller can only re-log their own
 * meals. The body carries only the optional client `newMealId` + the target
 * day/timezone; the action re-validates every field.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  try {
    const { mealId } = await params;
    const body = duplicateMealBodySchema.parse(await req.json());
    const result = await duplicateMealAction({ mealId, ...body });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
