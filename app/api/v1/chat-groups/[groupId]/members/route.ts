import { type NextRequest, NextResponse } from 'next/server';
import { addChatGroupMembers } from '@/lib/actions/chat-groups/membership';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const body = (await readJsonBody(request)) as { memberUserIds: string[] };
    const result = await addChatGroupMembers(actorId, {
      groupId,
      memberUserIds: body.memberUserIds,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
