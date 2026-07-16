import { type NextRequest, NextResponse } from 'next/server';
import { setMealShareVisibility } from '@/lib/actions/group-members';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const result = await setMealShareVisibility(
      actorId,
      body as { mealId: string; visibility: 'private' | 'circle' }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
