import { type NextRequest, NextResponse } from 'next/server';
import { undoMealShareAction } from '@/lib/actions/meal-sharing/undo';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

// Thin pass-through, like its sibling: the action self-authenticates and its
// Zod schema validates the shape.
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await undoMealShareAction(body as { mealId: string });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
