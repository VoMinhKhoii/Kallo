import { type NextRequest, NextResponse } from 'next/server';
import {
  listChatGroupMessages,
  sendChatGroupMessage,
} from '@/lib/actions/chat-groups';
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
    const messages = await listChatGroupMessages(actorId, { groupId });
    return NextResponse.json({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const body = await readJsonBody(request);
    const message = await sendChatGroupMessage(actorId, {
      groupId,
      body: (body as { body: string }).body,
    });
    return NextResponse.json({ message });
  } catch (error) {
    return handleRouteError(error);
  }
}
