import { eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import { notifications, pushTokens } from '@/lib/infra/db/schema';

/** How many trailing characters of a push token the export keeps. */
const TOKEN_TAIL = 6;

/**
 * A device token is a delivery address for one handset, and an export file is
 * the kind of thing people forward. The export shows the registration exists
 * (and lets the user tell devices apart) with the last few characters only.
 */
export function redactPushToken(token: string): string {
  return token.length <= TOKEN_TAIL
    ? '…'
    : `…${token.slice(token.length - TOKEN_TAIL)}`;
}

/**
 * The activity feed addressed to the user, and the devices registered to
 * receive it as push notifications.
 *
 * `rebadged` is left out: it is a per-statement scratch flag that means
 * nothing outside the upsert that set it (see the schema).
 */
export async function loadNotificationsExport(db: AppDb, userId: string) {
  const [notificationRows, tokenRows] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        actorIds: notifications.actorIds,
        actorCount: notifications.actorCount,
        objectType: notifications.objectType,
        objectId: notifications.objectId,
        targetType: notifications.targetType,
        targetId: notifications.targetId,
        data: notifications.data,
        createdAt: notifications.createdAt,
        updatedAt: notifications.updatedAt,
        seenAt: notifications.seenAt,
        readAt: notifications.readAt,
        dismissedAt: notifications.dismissedAt,
      })
      .from(notifications)
      .where(eq(notifications.recipientId, userId)),
    db
      .select({
        id: pushTokens.id,
        token: pushTokens.token,
        platform: pushTokens.platform,
        lastSeenAt: pushTokens.lastSeenAt,
        createdAt: pushTokens.createdAt,
      })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId)),
  ]);

  return {
    notifications: notificationRows,
    pushDevices: tokenRows.map(({ token, ...row }) => ({
      ...row,
      tokenHint: redactPushToken(token),
    })),
  };
}
