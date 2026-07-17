import { type NextRequest, NextResponse } from 'next/server';
import { listGroupTimeline } from '@/lib/actions/chat-groups/timeline';
import { requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    const before = request.nextUrl.searchParams.get('before') ?? undefined;
    const page = await listGroupTimeline(actorId, { groupId, before });
    return NextResponse.json(page);
  } catch (error) {
    return serializeError(error);
  }
}
