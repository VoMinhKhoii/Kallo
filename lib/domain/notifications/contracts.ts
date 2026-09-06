// ---------------------------------------------------------------------------
// Notifications — the /api/v1/notifications* wire contract
// ---------------------------------------------------------------------------
// Isomorphic: the route handlers parse with these, the client module types its
// responses with them, and the Flutter port reads them as the spec. Nothing
// here may import server code (db, next/server, auth) — it lives beside the
// domain rather than in lib/api/contracts/ because that folder is at the
// ten-direct-files structure limit.

import { z } from 'zod';
import {
  beforeCursorSchema,
  uuidSchema,
} from '@/lib/core/validation/primitives';
import type { PublicIdentity } from '@/lib/domain/social/identity/public-identity';
import type { NotificationType } from './types';

/** GET /api/v1/notifications — one page of the activity feed. */
export const notificationsListQuerySchema = z.object({
  /** Opaque tuple cursor from a prior page's `nextCursor`. */
  before: beforeCursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/** POST /api/v1/notifications/seen — bulk badge clear on opening Activity. */
export const markSeenBodySchema = z.object({
  /** Everything at or before this instant is seen — the newest createdAt in
   *  the snapshot the user actually looked at, never `now()`, so activity that
   *  arrived mid-render is not silently swallowed. */
  before: z.string().datetime({ offset: true }),
});

/** POST /api/v1/notifications/read — per-row dim on tap. */
export const markReadBodySchema = z.object({
  ids: z.array(uuidSchema).min(1).max(50),
});

/** POST/DELETE /api/v1/notifications/push-tokens — device registration.
 *  The token is the identity: iOS hands the same string to whoever is signed
 *  in on that handset, so POST reassigns it and DELETE is scoped to the caller
 *  so one account can never unregister another's device. */
export const pushTokenBodySchema = z.object({
  /** APNs device token (hex). Long and opaque; 4096 is well past today's 64
   *  chars and keeps a malformed body from reaching the database. */
  token: z.string().min(1).max(4096),
  /** iOS only — APNs is the sole transport we ship, so accepting an Android or
   *  web registration would store a token we could never deliver to. The DB
   *  CHECK stays wider on purpose; narrowing happens at the edge. */
  platform: z.literal('ios'),
});

/** DELETE only needs the token — the owner comes from the session. */
export const deletePushTokenBodySchema = pushTokenBodySchema.pick({
  token: true,
});

export type NotificationsListQuery = z.infer<
  typeof notificationsListQuerySchema
>;
export type MarkSeenBody = z.infer<typeof markSeenBodySchema>;
export type MarkReadBody = z.infer<typeof markReadBodySchema>;
export type PushTokenBody = z.infer<typeof pushTokenBodySchema>;
export type DeletePushTokenBody = z.infer<typeof deletePushTokenBodySchema>;

/** One rendered row. `actors` is the hydrated ≤3 recency list; `actorCount` is
 *  the true total behind "and N others". */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  actors: PublicIdentity[];
  actorCount: number;
  objectType: string | null;
  objectId: string | null;
  targetType: string | null;
  targetId: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  seenAt: string | null;
  readAt: string | null;
  /** Live domain state for actionable `share.invite` rows — the notification
   *  never owns it, so acting from anywhere stays consistent. Null otherwise. */
  invite: { status: string } | null;
}

/** GET /api/v1/notifications response. */
export interface NotificationFeedPage {
  items: NotificationItem[];
  nextCursor: string | null;
  unseenCount: number;
}

/** GET /api/v1/notifications/badge response — the poll behind the nav badge,
 *  and the client's only liveness signal for the feed. */
export interface NotificationBadge {
  /** Rows with `seenAt` null and `dismissedAt` null. */
  unseen: number;
  /** `max(updatedAt)` over the caller's undismissed rows, null when they have
   *  none. Opaque to the client: it only compares it with the previous poll.
   *  A change means SOMETHING moved — including a silent refresh that
   *  re-surfaced an aggregate without changing `unseen`. */
  latestActivityAt: string | null;
}
