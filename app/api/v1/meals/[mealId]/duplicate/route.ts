import type { NextRequest } from 'next/server';
import { duplicateMealAction } from '@/lib/actions/meals/duplicate-meal';
import { readJsonBody } from '@/lib/api/auth';
import { duplicateMealBodySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

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
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = duplicateMealBodySchema.parse(await readJsonBody(req));
    const result = await duplicateMealAction({ mealId, ...body });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
