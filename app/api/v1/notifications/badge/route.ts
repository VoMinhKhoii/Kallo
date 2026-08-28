import { NextResponse } from 'next/server';
import { readBadgeState } from '@/lib/actions/notifications/state';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** The 30-second badge poll — deliberately the cheapest endpoint we have. It
 *  carries the activity watermark alongside the count, because it is also the
 *  client's only liveness signal for the feed. */
export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await readBadgeState(userId));
  } catch (error) {
    return handleRouteError(error);
  }
}
