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

export type NotificationsListQuery = z.infer<
  typeof notificationsListQuerySchema
>;
export type MarkSeenBody = z.infer<typeof markSeenBodySchema>;
export type MarkReadBody = z.infer<typeof markReadBodySchema>;

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
