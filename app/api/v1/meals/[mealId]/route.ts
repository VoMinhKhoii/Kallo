import type { NextRequest } from 'next/server';
import {
  deleteMealAction,
  updateMealAction,
} from '@/lib/actions/meals/mutate-meal';
import { readJsonBody } from '@/lib/api/auth';
import { updateMealBodySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  try {
    const { mealId } = await params;
    const result = await deleteMealAction({ mealId });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ mealId: string }> }
) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const { mealId } = await params;
    const body = updateMealBodySchema.parse(await readJsonBody(req));
    const result = await updateMealAction({ mealId, ...body });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
