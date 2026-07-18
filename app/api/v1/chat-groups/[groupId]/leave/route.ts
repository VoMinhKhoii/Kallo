import { type NextRequest, NextResponse } from 'next/server';
import { leaveChatGroup } from '@/lib/actions/chat-groups/membership';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    return NextResponse.json(await leaveChatGroup(actorId, groupId));
  } catch (error) {
    return handleRouteError(error);
  }
}
