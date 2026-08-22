import { type NextRequest, NextResponse } from 'next/server';
import { removeChatGroupMember } from '@/lib/actions/chat-groups/membership';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId, userId } = await params;
    const result = await removeChatGroupMember(actorId, {
      groupId,
      memberUserId: userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
