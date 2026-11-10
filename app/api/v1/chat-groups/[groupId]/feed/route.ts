import { type NextRequest, NextResponse } from 'next/server';
import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { ServerTiming } from '@/lib/infra/http/server-timing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const timing = new ServerTiming();
  let response: NextResponse;
  try {
    const actorId = await timing.measure('auth', () => requireUserId());
    const { groupId } = await params;
    const rawBefore = request.nextUrl.searchParams.get('before');
    const before = rawBefore?.trim() || undefined;
    // Validated (shared | eaten, default shared) by the action's schema.
    const order = request.nextUrl.searchParams.get('order') ?? undefined;
    const page = await listGroupMealFeed(
      actorId,
      { groupId, before, order },
      undefined,
      timing
    );
    response = NextResponse.json(page);
  } catch (error) {
    response = handleRouteError(error);
  }
  response.headers.set('Server-Timing', timing.toHeader());
  console.info(
    JSON.stringify({
      kind: 'circle_feed_timing_v1',
      status: response.status,
      stagesMs: timing.toJSON(),
    })
  );
  return response;
}
