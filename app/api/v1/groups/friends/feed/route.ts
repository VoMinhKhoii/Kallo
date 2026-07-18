import { type NextRequest, NextResponse } from 'next/server';
import { listFriendsThreadFeed } from '@/lib/actions/groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const rawBefore = request.nextUrl.searchParams.get('before');
    const before = rawBefore?.trim() || undefined;
    const page = await listFriendsThreadFeed(actorId, { before });
    return NextResponse.json(page);
  } catch (error) {
    return handleRouteError(error);
  }
}
