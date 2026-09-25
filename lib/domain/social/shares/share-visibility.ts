// ---------------------------------------------------------------------------
// Meal-share visibility — canonical cross-user authorization gate
// ---------------------------------------------------------------------------
// Drizzle uses the owner connection and bypasses Supabase RLS. Every action
// that starts from a share id must pass through this gate before reading the
// underlying cross-user meal.

import { eq, type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { notBlockedWithSql } from '@/lib/domain/social/moderation/blocks';
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
const groupMembership = alias(chatGroupMembers, 'share_group_membership');

/**
 * The friend half of the access contract: an accepted friendship between the
 * two users that was accepted at or before `sharedAt`. A friend sees what was
 * shared after they connected, never the backlog from before (KALLO-03) — the
 * same rule `public.is_friend_since` applies at the RLS layer. Exported so the
 * feed queries, which read many shares at once, fold in the identical
 * predicate rather than restating it.
 */
export function friendSinceSql(
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
        AND ${friendships.acceptedAt} <= ${sharedAt}
    )
  `;
}

/** The share columns (or bound values) a visibility predicate reads. */
export interface ShareColumns {
  actorId: SQLWrapper | string;
  sharedAt: SQLWrapper | Date;
  visibility: SQLWrapper | string;
}

/**
 * PURE group membership: `viewerId` and the share's owner are both members of
 * `groupId`, and both joined at or before the share. Knows nothing about
 * visibility or blocks — the composites below add those.
 */
function groupMembersSinceSql(
  viewerId: string,
  groupId: SQLWrapper | string,
  ownerId: SQLWrapper | string,
  sharedAt: SQLWrapper | Date
): SQL<boolean> {
  // Base table + alias spelled out: Drizzle renders an alias object inside raw
  // sql as the bare alias name, which is not a relation.
  return sql<boolean>`
    EXISTS (
      SELECT 1
      FROM "chat_group_members" AS "share_viewer_membership"
      WHERE ${viewerMembership.groupId} = ${groupId}
        AND ${viewerMembership.userId} = ${viewerId}
        AND ${viewerMembership.joinedAt} <= ${sharedAt}
    )
    AND EXISTS (
      SELECT 1
      FROM "chat_group_members" AS "share_owner_membership"
      WHERE ${ownerMembership.groupId} = ${groupId}
        AND ${ownerMembership.userId} = ${ownerId}
        AND ${ownerMembership.joinedAt} <= ${sharedAt}
    )
  `;
}

/**
 * THE group-share rule, for reads scoped to one chat group: the share is not
 * private, the viewer and its owner are not blocked, and both were members of
 * `groupId` when it was shared. Every group read folds this in — the group
 * feed, the chat list's unread flag and its last-meal activity — so none can
 * drift from another. (The share-by-id gate below composes the same pieces,
 * with blocks applied once at its top instead of per branch.)
 */
export function groupShareVisibleSql(
  viewerId: string,
  groupId: SQLWrapper | string,
  share: ShareColumns
): SQL<boolean> {
  return sql<boolean>`(
    ${share.visibility} <> 'private'
    AND ${notBlockedWithSql(viewerId, share.actorId)}
    AND ${groupMembersSinceSql(viewerId, groupId, share.actorId, share.sharedAt)}
  )`;
}

/** The friend branch, else ANY named group both people were in when it was
 * shared. Pure: no visibility, no blocks. Driven from the viewer's own
 * memberships so the planner never walks every group. */
function relationshipAccessSql(
  viewerId: string,
  ownerId: SQLWrapper | string,
  sharedAt: SQLWrapper | Date
): SQL<boolean> {
  return sql<boolean>`
    ${friendSinceSql(viewerId, ownerId, sharedAt)}
    OR EXISTS (
      SELECT 1
      FROM "chat_group_members" AS "share_group_membership"
      INNER JOIN ${chatGroups}
        ON ${chatGroups.id} = ${groupMembership.groupId}
      WHERE ${groupMembership.userId} = ${viewerId}
        AND ${chatGroups.kind} = 'group'
        AND ${groupMembersSinceSql(viewerId, chatGroups.id, ownerId, sharedAt)}
    )
  `;
}

/**
 * Could `viewerId` see this share, IGNORING blocks: owner, else non-private
 * and a live relationship. Only for callers that must judge a share the
 * viewer has since blocked — a content report ("block, then report" must not
 * turn into a 404) — never for serving content. Everything that shows a share
 * uses {@link shareAccessSql}.
 */
export function shareVisibleIgnoringBlocksSql(
  viewerId: string,
  ownerId: SQLWrapper | string,
  sharedAt: SQLWrapper | Date,
  visibility: SQLWrapper | string
): SQL<boolean> {
  return sql<boolean>`(
    ${ownerId} = ${viewerId}
    OR (
      ${visibility} <> 'private'
      AND (${relationshipAccessSql(viewerId, ownerId, sharedAt)})
    )
  )`;
}

/**
 * The whole access contract as one composable boolean: not blocked, then the
 * relationship rule above. Blocks are applied ONCE, here at the top, so no
 * branch (friend, group, a future one) can forget them. Exported so a caller
 * that is already reading the share row can fold admission into that row's
 * `WHERE` instead of asking first and reading second — one statement cannot
 * have its answer change between the two halves. `canViewShare` remains the
 * form for callers holding only an id.
 */
export function shareAccessSql(
  viewerId: string,
  ownerId: SQLWrapper | string,
  sharedAt: SQLWrapper | Date,
  visibility: SQLWrapper | string
): SQL<boolean> {
  return sql<boolean>`(
    ${notBlockedWithSql(viewerId, ownerId)}
    AND ${shareVisibleIgnoringBlocksSql(viewerId, ownerId, sharedAt, visibility)}
  )`;
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
 * private shares; cross-user reads require a live friendship accepted before
 * the share, or a named-group membership that predates the share for both
 * people. */
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
 * hand; the block check and the relationship rule still run in SQL. */
export async function canViewShareOwnedBy(
  viewerId: string,
  share: { actorId: string; sharedAt: Date; visibility: string },
  db: Db
): Promise<boolean> {
  if (share.actorId === viewerId) return true;
  if (share.visibility === 'private') return false;

  return readVisible(
    db,
    sql`SELECT (${notBlockedWithSql(viewerId, share.actorId)} AND (${relationshipAccessSql(
      viewerId,
      share.actorId,
      // Bound through the column encoder: a bare Date in a raw fragment
      // reaches the driver unserialized and throws.
      sql.param(share.sharedAt, mealShares.sharedAt)
    )})) AS visible`
  );
}
