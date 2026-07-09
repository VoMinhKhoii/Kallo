import { type NextRequest, NextResponse } from 'next/server';
import { listGroupMealFeed } from '@/lib/actions/chat-groups';
import { requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors';
import { timezoneOffsetSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { groupId } = await params;
    // Validate the URL param at the boundary; fall back to UTC on garbage
    // input rather than letting NaN reach the day-window math.
    const parsedOffset = timezoneOffsetSchema.safeParse(
      Number(request.nextUrl.searchParams.get('timezoneOffset'))
    );
    const timezoneOffset = parsedOffset.success ? parsedOffset.data : 0;
    const feed = await listGroupMealFeed(actorId, { groupId, timezoneOffset });
    return NextResponse.json({ feed });
  } catch (error) {
    return serializeError(error);
  }
}
