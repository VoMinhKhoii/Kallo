import { type NextRequest, NextResponse } from 'next/server';
import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const rawBefore = request.nextUrl.searchParams.get('before');
    const before = rawBefore?.trim() || undefined;
    // Validated (shared | eaten, default shared) by the action's schema.
    const order = request.nextUrl.searchParams.get('order') ?? undefined;
    const page = await listGroupMealFeed(actorId, { groupId, before, order });
    return NextResponse.json(page);
  } catch (error) {
    return handleRouteError(error);
  }
}
