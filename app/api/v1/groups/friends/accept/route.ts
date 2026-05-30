import { type NextRequest, NextResponse } from 'next/server';
import { acceptFriend } from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { readJsonBody, requireUserId } from '../../_auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const result = await acceptFriend(
      actorId,
      body as { friendshipId: string }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
