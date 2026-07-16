import { type NextRequest, NextResponse } from 'next/server';
import { listFriendsThreadFeed } from '@/lib/actions/groups';
import { requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    // Absent/garbage `before` falls back to the first page rather than
    // hard-failing — a stale/malformed cursor should never break the thread.
    const rawBefore = request.nextUrl.searchParams.get('before');
    const before =
      rawBefore && !Number.isNaN(Date.parse(rawBefore)) ? rawBefore : undefined;
    const page = await listFriendsThreadFeed(actorId, { before });
    return NextResponse.json(page);
  } catch (error) {
    return serializeError(error);
  }
}
