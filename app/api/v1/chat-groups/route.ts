import { type NextRequest, NextResponse } from 'next/server';
import { createChatGroup, listMyChatGroups } from '@/lib/actions/chat-groups';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const actorId = await requireUserId();
    const groups = await listMyChatGroups(actorId);
    return NextResponse.json({ groups });
  } catch (error) {
    return serializeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const group = await createChatGroup(
      actorId,
      body as { name: string; memberUserIds: string[] }
    );
    return NextResponse.json({ group });
  } catch (error) {
    return serializeError(error);
  }
}
