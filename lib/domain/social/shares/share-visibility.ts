// ---------------------------------------------------------------------------
// Meal-share visibility — canonical cross-user authorization gate
// ---------------------------------------------------------------------------
// Drizzle uses the owner connection and bypasses Supabase RLS. Every action
// that starts from a share id must pass through this gate before reading the
// underlying cross-user meal.

import { eq, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  chatGroups,
  friendships,
  mealShares,
} from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

const viewerMembership = alias(chatGroupMembers, 'share_viewer_membership');
const ownerMembership = alias(chatGroupMembers, 'share_owner_membership');

function relationshipAccessSql(
  viewerId: string,
  ownerId: SQLWrapper | string,
  sharedAt: SQLWrapper | Date
): SQL<boolean> {
  return sql<boolean>`
    EXISTS (
      SELECT 1
      FROM ${friendships}
      WHERE ${friendships.status} = 'accepted'
        AND (
          (${friendships.userLow} = ${viewerId}
            AND ${friendships.userHigh} = ${ownerId})
          OR (${friendships.userHigh} = ${viewerId}
            AND ${friendships.userLow} = ${ownerId})
        )
    )
    OR EXISTS (
      SELECT 1
      -- Base table + alias spelled out: Drizzle renders an alias object inside
      -- raw sql as the bare alias name, which is not a relation.
      FROM "chat_group_members" AS "share_viewer_membership"
      INNER JOIN "chat_group_members" AS "share_owner_membership"
        ON ${ownerMembership.groupId} = ${viewerMembership.groupId}
      INNER JOIN ${chatGroups}
        ON ${chatGroups.id} = ${viewerMembership.groupId}
      WHERE ${chatGroups.kind} = 'group'
        AND ${viewerMembership.userId} = ${viewerId}
        AND ${ownerMembership.userId} = ${ownerId}
        AND ${viewerMembership.joinedAt} <= ${sharedAt}
        AND ${ownerMembership.joinedAt} <= ${sharedAt}
    )
  `;
}

function shareAccessSql(
  viewerId: string,
  ownerId: SQLWrapper | string,
  sharedAt: SQLWrapper | Date,
  visibility: SQLWrapper | string
): SQL<boolean> {
  return sql<boolean>`
    ${ownerId} = ${viewerId}
    OR (
      ${visibility} <> 'private'
      AND (${relationshipAccessSql(viewerId, ownerId, sharedAt)})
    )
  `;
}

/**
 * Run one visibility predicate and read its single boolean back.
 *
 * Both gates go through `db.execute` rather than `db.select({...})`, because
 * Drizzle strips the table prefix off every column sitting at the TOP level of
 * a select field when the query has no joins (`buildSelection`'s
 * `isSingleTable` path). That turned the membership self-join into
 * `ON "group_id" = "group_id"` — Postgres 42702, "column reference group_id is
 * ambiguous", on every cross-user reaction and reply. `sqlToQuery`, which
 * `db.execute` renders through, qualifies everything. Using it for both gates
 * is what makes that hazard structural rather than a comment somebody has to
 * remember: there is no longer a query shape here that can regress into it.
 *
 * The `unknown` hop is Drizzle's untyped `execute` return, and it lives here
 * once instead of at each call site.
 */
async function readVisible(db: Db, statement: SQL): Promise<boolean> {
  const rows = (await db.execute(statement)) as unknown as Array<{
    visible: boolean | null;
  }>;
  return Boolean(rows[0]?.visible);
}

/** Authorize a share id in exactly one statement. Owners retain access to
 * private shares; cross-user reads require a live friendship or a named-group
 * membership that predates the share for both people. */
export async function canViewShare(
  viewerId: string,
  shareId: string,
  db: Db = defaultDb
): Promise<boolean> {
  return readVisible(
    db,
    sql`
      SELECT (${shareAccessSql(
        viewerId,
        mealShares.actorId,
        mealShares.sharedAt,
        mealShares.visibility
      )}) AS visible
      FROM ${mealShares}
      WHERE ${eq(mealShares.id, shareId)}
      LIMIT 1
    `
  );
}

/** Variant for callers that already locked and read the share row. This skips
 * the duplicate meal_shares read while preserving the same access contract —
 * the owner and private short-circuits are the two branches `shareAccessSql`
 * evaluates in SQL, decided here in TypeScript because the row is already in
 * hand. */
export async function canViewShareOwnedBy(
  viewerId: string,
  share: { actorId: string; sharedAt: Date; visibility: string },
  db: Db
): Promise<boolean> {
  if (share.actorId === viewerId) return true;
  if (share.visibility === 'private') return false;

  return readVisible(
    db,
    sql`SELECT (${relationshipAccessSql(
      viewerId,
      share.actorId,
      // Bound through the column encoder: a bare Date in a raw fragment
      // reaches the driver unserialized and throws.
      sql.param(share.sharedAt, mealShares.sharedAt)
    )}) AS visible`
  );
}
