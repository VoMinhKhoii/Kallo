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

/** Authorize a share id in exactly one statement. Owners retain access to
 * private shares; cross-user reads require a live friendship or a named-group
 * membership that predates the share for both people. */
export async function canViewShare(
  viewerId: string,
  shareId: string,
  db: Db = defaultDb
): Promise<boolean> {
  const [row] = await db
    .select({
      visible: shareAccessSql(
        viewerId,
        mealShares.actorId,
        mealShares.sharedAt,
        mealShares.visibility
      ),
    })
    .from(mealShares)
    .where(eq(mealShares.id, shareId))
    .limit(1);
  return Boolean(row?.visible);
}

/** Variant for callers that already locked and read the share row. This skips
 * the duplicate meal_shares read while preserving the same access contract. */
export async function canViewShareOwnedBy(
  viewerId: string,
  share: { actorId: string; sharedAt: Date; visibility: string },
  db: Db
): Promise<boolean> {
  if (share.actorId === viewerId) return true;
  if (share.visibility === 'private') return false;

  const [row] = await db
    .select({
      visible: relationshipAccessSql(viewerId, share.actorId, share.sharedAt),
    })
    .from(sql`(SELECT 1) AS share_access_check`)
    .limit(1);
  return Boolean(row?.visible);
}
