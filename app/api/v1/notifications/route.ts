import { type NextRequest, NextResponse } from 'next/server';
import { listNotifications } from '@/lib/actions/notifications/list';
import { countUnseen } from '@/lib/actions/notifications/state';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { notificationsListQuerySchema } from '@/lib/domain/notifications/contracts';

export const runtime = 'nodejs';

/** One page of the activity feed, plus the badge count so opening Activity
 *  costs a single round trip. */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const params = request.nextUrl.searchParams;
    const { before, limit } = notificationsListQuerySchema.parse({
      before: params.get('before') ?? undefined,
      limit: params.get('limit') ?? undefined,
    });
    const [page, unseenCount] = await Promise.all([
      listNotifications(userId, { cursor: before, limit }),
      countUnseen(userId),
    ]);
    return NextResponse.json({ ...page, unseenCount });
  } catch (error) {
    return handleRouteError(error);
  }
}
