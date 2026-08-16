import { type NextRequest, NextResponse } from 'next/server';
import { listCircleFeed } from '@/lib/actions/groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { timezoneOffsetSchema } from '@/lib/validation/primitives';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    // Validate the URL param at the boundary; fall back to UTC on garbage
    // input rather than letting NaN reach the day-window math.
    const parsedOffset = timezoneOffsetSchema.safeParse(
      Number(request.nextUrl.searchParams.get('timezoneOffset'))
    );
    const timezoneOffset = parsedOffset.success ? parsedOffset.data : 0;
    const feed = await listCircleFeed(actorId, { timezoneOffset });
    return NextResponse.json({ feed });
  } catch (error) {
    return handleRouteError(error);
  }
}
