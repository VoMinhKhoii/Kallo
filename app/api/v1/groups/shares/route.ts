import { NextResponse, type NextRequest } from 'next/server';
import { setMealShareVisibility } from '@/lib/actions/group-members';
import { Errors, serializeError } from '@/lib/errors';
import { requireUserId } from '../_auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw Errors.validationFailed('Invalid JSON in request body');
    }
    const result = await setMealShareVisibility(
      actorId,
      body as { mealId: string; visibility: 'private' | 'circle' }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
