import { type NextRequest, NextResponse } from 'next/server';
import { addChatGroupMembers } from '@/lib/actions/chat-groups/membership';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { addChatGroupMembersBodySchema } from '@/lib/api/contracts/social/chat-groups';
import { handleRouteError } from '@/lib/api/respond';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const body = addChatGroupMembersBodySchema.parse(
      await readJsonBody(request)
    );
    const result = await addChatGroupMembers(actorId, {
      groupId,
      memberUserIds: body.memberUserIds,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
