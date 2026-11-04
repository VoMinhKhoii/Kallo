import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import {
  deletePushTokenBodySchema,
  pushTokenBodySchema,
} from '@/lib/domain/notifications/contracts';
import { registerDevice } from '@/lib/domain/notifications/push-devices';
import { db } from '@/lib/infra/db/client';
import { pushTokens } from '@/lib/infra/db/schema';

/**
 * Register (or refresh) this device — `registerDevice` owns the upsert, the
 * ten-device prune and the reported time zone. Idempotent, so the client posts
 * on every launch, token refresh and return to the foreground.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = pushTokenBodySchema.parse(await readJsonBody(request));
    await registerDevice(userId, body);
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
