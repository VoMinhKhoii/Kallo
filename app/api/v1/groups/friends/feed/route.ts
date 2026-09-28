import { type NextRequest, NextResponse } from 'next/server';
import { listFriendsThreadFeed } from '@/lib/actions/groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const rawBefore = request.nextUrl.searchParams.get('before');
    const before = rawBefore?.trim() || undefined;
    // Validated (shared | eaten, default shared) by the action's schema.
    const order = request.nextUrl.searchParams.get('order') ?? undefined;
    const page = await listFriendsThreadFeed(actorId, { before, order });
    return NextResponse.json(page);
  } catch (error) {
    return handleRouteError(error);
  }
}
