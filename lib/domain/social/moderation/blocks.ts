// ---------------------------------------------------------------------------
// Blocks — who a viewer must not see, and who must not see them
// ---------------------------------------------------------------------------
// A block is one `friendships` row with status 'blocked' for the canonical
// pair; it hides BOTH directions, whoever placed it. The friend branch of
// every visibility rule already requires status 'accepted', so a block ends
// the friendship there by construction. What this module covers is the rest:
// the places where two people still meet through a shared named group — the
// group feed, share-by-id through a group, replies and reactions on a third
// person's share, and group-chat messages.
//
// Two forms of the same rule: a SQL predicate for queries that read many rows
// (it folds into their WHERE), and a set of ids for callers already holding
// rows in memory (push audiences, notification recipients).

import { and, eq, or, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import { friendships } from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

/**
 * True when `viewerId` and `otherId` are in a blocked relation, in either
 * direction. `otherId` may be a column (the author of the row being read) or a
 * literal id. Every column is table-qualified — this predicate is embedded in
 * `db.execute` statements where a bare `status` would be ambiguous (42702).
 */
export function blockedBetweenSql(
  viewerId: string,
  otherId: SQLWrapper | string
): SQL<boolean> {
  return sql<boolean>`
    EXISTS (
      SELECT 1
      FROM ${friendships}
      WHERE ${friendships.status} = 'blocked'
        AND (
          (${friendships.userLow} = ${viewerId}
            AND ${friendships.userHigh} = ${otherId})
          OR (${friendships.userHigh} = ${viewerId}
            AND ${friendships.userLow} = ${otherId})
        )
    )
  `;
}

/** The negation, for a read's WHERE: keep only rows whose author is not
 * blocked with the viewer. The viewer's own rows always pass (no self-edge). */
export function notBlockedWithSql(
  viewerId: string,
  otherId: SQLWrapper | string
): SQL<boolean> {
  return sql<boolean>`NOT ${blockedBetweenSql(viewerId, otherId)}`;
}

/** Every user id in a blocked relation with `viewerId`, either direction. */
export async function blockedUserIds(
  viewerId: string,
  db: Db = defaultDb
): Promise<Set<string>> {
  const rows = await db
    .select({ userLow: friendships.userLow, userHigh: friendships.userHigh })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'blocked'),
        or(
          eq(friendships.userLow, viewerId),
          eq(friendships.userHigh, viewerId)
        )
      )
    );
  return new Set(
    rows.map((row) => (row.userLow === viewerId ? row.userHigh : row.userLow))
  );
}
