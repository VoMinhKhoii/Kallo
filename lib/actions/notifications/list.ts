// ---------------------------------------------------------------------------
// Activity feed — one page of the actor's notifications
// ---------------------------------------------------------------------------
// SECURITY: the Drizzle handle bypasses RLS, so `recipient_id = userId` in the
// WHERE below is the primary authorization control, not defence in depth.
//
// Two things are deliberately joined rather than stored: actor identities
// (names and avatars change, the row keeps only ids) and the live status of an
// actionable invite (accepting from the Circle page must be reflected here, and
// vice versa — the notification never owns that state).

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import type { NotificationType } from '@/lib/domain/notifications/types';
import {
  decodeSharedMealCursor,
  encodeSharedMealCursor,
} from '@/lib/domain/social/feed/cursor';
import {
  type PublicIdentity,
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/domain/social/identity/public-identity';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  mealShareInvites,
  notifications,
  publicProfiles,
} from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

export interface NotificationFeedResult {
  items: NotificationItem[];
  nextCursor: string | null;
}

export async function listNotifications(
  userId: string,
  input: { cursor?: string; limit: number },
  db: Db = defaultDb
): Promise<NotificationFeedResult> {
  const before = decodeCursor(input.cursor);

  const rows = await db
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
      createdAtText: sql<string>`${notifications.createdAt}::text`,
      updatedAt: notifications.updatedAt,
      seenAt: notifications.seenAt,
      readAt: notifications.readAt,
      inviteStatus: mealShareInvites.status,
    })
    .from(notifications)
    // Only `share.invite` rows point at an invite; every other type leaves the
    // join unmatched and reports `invite: null`.
    .leftJoin(
      mealShareInvites,
      and(
        eq(notifications.type, 'share.invite'),
        eq(mealShareInvites.id, notifications.objectId)
      )
    )
    .where(
      and(
        eq(notifications.recipientId, userId),
        isNull(notifications.dismissedAt),
        before
          ? sql`(${notifications.createdAt}, ${notifications.id}) < (${before.ts}::timestamptz, ${before.id}::uuid)`
          : undefined
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeSharedMealCursor({ ts: last.createdAtText, id: last.id })
      : null;

  const actors = await hydrateActors(
    page.flatMap((row) => row.actorIds),
    db
  );

  const items = page.map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    actors: row.actorIds
      .map((actorId) => actors.get(actorId))
      .filter((actor): actor is PublicIdentity => actor !== undefined),
    actorCount: row.actorCount,
    objectType: row.objectType,
    objectId: row.objectId,
    targetType: row.targetType,
    targetId: row.targetId,
    data: (row.data ?? null) as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    seenAt: row.seenAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    invite: row.inviteStatus ? { status: row.inviteStatus } : null,
  }));

  return { items, nextCursor };
}

/** The shared tuple-cursor codec, re-fronted with an activity-appropriate
 *  message (the feed helper's own text names the meal wall). */
function decodeCursor(cursor: string | undefined) {
  try {
    return decodeSharedMealCursor(cursor);
  } catch {
    throw Errors.validationFailed('Con trỏ thông báo không hợp lệ.');
  }
}

/** One IN query across every actor id on the page. */
async function hydrateActors(
  actorIds: string[],
  db: Db
): Promise<Map<string, PublicIdentity>> {
  const unique = [...new Set(actorIds)];
  if (unique.length === 0) return new Map();

  const profiles = await db
    .select({ userId: publicProfiles.userId, ...publicProfileColumns })
    .from(publicProfiles)
    .where(inArray(publicProfiles.userId, unique));

  return new Map(
    profiles.map((profile) => [profile.userId, toPublicIdentity(profile)])
  );
}
