import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import {
  deletePushTokenBodySchema,
  pushTokenBodySchema,
} from '@/lib/domain/notifications/contracts';
import { db } from '@/lib/infra/db/client';
import { pushTokens } from '@/lib/infra/db/schema';

export const runtime = 'nodejs';

/**
 * Register (or refresh) this device. The APNs token is unique across the
 * table because the OS hands the same string to whoever signs in on that
 * handset next: the conflict update REASSIGNS the row to the caller rather
 * than leaving a stale owner receiving the new user's notifications.
 * Idempotent, so the client can post on every launch and token refresh.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = pushTokenBodySchema.parse(await readJsonBody(request));
    await db
      .insert(pushTokens)
      .values({ userId, token: body.token, platform: body.platform })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId,
          platform: body.platform,
          // The liveness signal the 270-day retention reap reads.
          lastSeenAt: new Date(),
        },
      });
    return NextResponse.json({ registered: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Unregister on sign-out. Scoped to the caller AND the token, so knowing
 * someone else's registration string is not enough to silence their phone;
 * a token that is not the caller's simply deletes nothing.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = deletePushTokenBodySchema.parse(await readJsonBody(request));
    const removed = await db
      .delete(pushTokens)
      .where(
        and(eq(pushTokens.userId, userId), eq(pushTokens.token, body.token))
      )
      .returning({ id: pushTokens.id });
    return NextResponse.json({ removed: removed.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
