import { type NextRequest, NextResponse } from 'next/server';
import {
  getChatGroup,
  renameChatGroup,
} from '@/lib/actions/chat-groups/details';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const group = await getChatGroup(actorId, { groupId });
    return NextResponse.json({ group });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const body = (await readJsonBody(request)) as { name: string };
    const result = await renameChatGroup(actorId, { groupId, name: body.name });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
