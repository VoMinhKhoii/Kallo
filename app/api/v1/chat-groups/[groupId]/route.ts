import { type NextRequest, NextResponse } from 'next/server';
import { getChatGroup } from '@/lib/actions/chat-groups';
import { requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';

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
    return serializeError(error);
  }
}
