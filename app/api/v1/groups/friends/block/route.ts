import { type NextRequest, NextResponse } from 'next/server';
import { blockFriend } from '@/lib/actions/groups/friendship';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const result = await blockFriend(actorId, body as { targetUserId: string });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
