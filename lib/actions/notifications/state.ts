// ---------------------------------------------------------------------------
// Activity read-state — badge count, bulk mark-seen, per-row mark-read
// ---------------------------------------------------------------------------
// The Instagram tri-state: `seen_at` drives the badge and is cleared in bulk
// when Activity is opened, `read_at` only dims one row on tap.
//
// SECURITY: the Drizzle handle bypasses RLS. EVERY statement here carries
// `recipient_id = userId`, including the id-list update — an id belonging to
// somebody else must be a no-op, never a cross-tenant write.

import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import { notifications } from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

/** What the 30-second badge poll reads. */
export interface BadgeState {
  /** The nav badge itself: unseen, undismissed rows. */
  unseen: number;
  /**
   * Activity watermark — `max(updated_at)` across the recipient's undismissed
   * rows, ISO-8601, null when they have none. The client compares it against
   * the previous poll to know whether ANYTHING moved, which the count alone
   * cannot tell it: a silent refresh of an already-unseen aggregate resets
   * `created_at` (the row jumps back above a cursor the reader scrolled past)
   * while leaving the unseen count exactly where it was.
   */
  latestActivityAt: string | null;
}

/**
 * The badge poll's single query: the unseen count and the activity watermark
 * over the same recipient-scoped scan. Dismissed rows never count and never
 * move the watermark.
 */
export async function readBadgeState(
  userId: string,
  db: Db = defaultDb
): Promise<BadgeState> {
  const [row] = await db
    .select({
      unseen: sql<number>`count(*) FILTER (WHERE ${notifications.seenAt} IS NULL)::int`,
      latestActivityAt: sql<
        Date | string | null
      >`max(${notifications.updatedAt})`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, userId),
        isNull(notifications.dismissedAt)
      )
    );
  const watermark = row?.latestActivityAt ?? null;
  return {
    unseen: Number(row?.unseen ?? 0),
    latestActivityAt:
      watermark === null ? null : new Date(watermark).toISOString(),
  };
}

/**
 * Clear the badge for everything at or before `beforeIso` — the newest row in
 * the snapshot the user actually saw. Bounding it (rather than using now())
 * means a notification that arrives mid-visit still badges.
 */
export async function markSeen(
  userId: string,
  beforeIso: string,
  db: Db = defaultDb
): Promise<{ seen: number }> {
  const updated = await db
    .update(notifications)
    .set({ seenAt: sql`now()` })
    .where(
      and(
        eq(notifications.recipientId, userId),
        isNull(notifications.seenAt),
        lte(notifications.createdAt, new Date(beforeIso))
      )
    )
    .returning({ id: notifications.id });
  return { seen: updated.length };
}

/**
 * Mark rows read on tap. A read row also counts as seen — tapping straight
 * from an unseen feed must not leave the badge stuck — but an existing
 * `seen_at` is preserved so the original sighting time survives.
 */
export async function markRead(
  userId: string,
  ids: string[],
  db: Db = defaultDb
): Promise<{ read: number }> {
  if (ids.length === 0) return { read: 0 };

  const updated = await db
    .update(notifications)
    .set({
      readAt: sql`now()`,
      seenAt: sql`COALESCE(${notifications.seenAt}, now())`,
    })
    .where(
      and(eq(notifications.recipientId, userId), inArray(notifications.id, ids))
    )
    .returning({ id: notifications.id });
  return { read: updated.length };
}
