import { NextResponse } from 'next/server';
import { getFriendsFeedReadMarker } from '@/lib/actions/groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const actorId = await requireUserId();
    const marker = await getFriendsFeedReadMarker(actorId);
    return NextResponse.json(marker);
  } catch (error) {
    return serializeError(error);
  }
}
