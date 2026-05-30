import { NextResponse, type NextRequest } from 'next/server';
import { acceptFriend } from '@/lib/actions/groups';
import { Errors, serializeError } from '@/lib/errors';
import { requireUserId } from '../../_auth';

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
    const result = await acceptFriend(
      actorId,
      body as { friendshipId: string }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
