import type { NextRequest } from 'next/server';
import {
  deleteMealAction,
  updateMealAction,
} from '@/lib/actions/meals/mutate-meal';
import { updateMealBodySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

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
    const { mealId } = await params;
    const body = updateMealBodySchema.parse(await req.json());
    const result = await updateMealAction({ mealId, ...body });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
