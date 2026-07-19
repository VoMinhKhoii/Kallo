import { type NextRequest, NextResponse } from 'next/server';
import { listGroupMealFeed } from '@/lib/actions/chat-groups';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const rawBefore = request.nextUrl.searchParams.get('before');
    const before = rawBefore?.trim() || undefined;
    const page = await listGroupMealFeed(actorId, { groupId, before });
    return NextResponse.json(page);
  } catch (error) {
    return handleRouteError(error);
  }
}
