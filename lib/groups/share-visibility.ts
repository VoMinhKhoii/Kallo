// ---------------------------------------------------------------------------
// Meal-share visibility — canonical cross-user authorization gate
// ---------------------------------------------------------------------------
// Drizzle uses the owner connection and bypasses Supabase RLS. Every action
// that starts from a share id must pass through this gate before reading the
// underlying cross-user meal.

import { and, eq, lte, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppDb, AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import {
  chatGroupMembers,
  chatGroups,
  friendships,
  mealShares,
  meals,
} from '@/lib/db/schema';

type Db = AppDb | AppTransaction;

const viewerMembership = alias(chatGroupMembers, 'viewer_membership');
const ownerMembership = alias(chatGroupMembers, 'owner_membership');

/**
 * Authorize access to one broadcast meal share. Owners always retain access;
 * cross-user access requires a non-private share plus either a live accepted
 * friendship or co-membership of a NAMED group (both join dates predating the
 * share). Direct-chat membership does NOT count — those rows are kept after an
 * unfriend/block to preserve message history, so counting them would let an
 * ex-friend keep reading shares; direct-chat access is authorized solely by the
 * live accepted-friendship branch. Deleted friendship / named-group rows revoke
 * future reads immediately.
 */
export async function canViewShare(
  actorId: string,
  shareId: string,
  db: Db = defaultDb
): Promise<boolean> {
  const [share] = await db
    .select({
      ownerId: meals.userId,
      sharedAt: mealShares.sharedAt,
      visibility: mealShares.visibility,
    })
    .from(mealShares)
    .innerJoin(meals, eq(meals.id, mealShares.mealId))
    .where(eq(mealShares.id, shareId))
    .limit(1);

  if (!share) return false;
  if (share.ownerId === actorId) return true;
  if (share.visibility === 'private') return false;

  const [friendRows, groupRows] = await Promise.all([
    db
      .select({ id: friendships.id })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(
              eq(friendships.userLow, actorId),
              eq(friendships.userHigh, share.ownerId)
            ),
            and(
              eq(friendships.userHigh, actorId),
              eq(friendships.userLow, share.ownerId)
            )
          )
        )
      )
      .limit(1),
    db
      .select({
        groupId: viewerMembership.groupId,
        viewerJoinedAt: viewerMembership.joinedAt,
        ownerJoinedAt: ownerMembership.joinedAt,
      })
      .from(viewerMembership)
      .innerJoin(
        ownerMembership,
        eq(ownerMembership.groupId, viewerMembership.groupId)
      )
      .innerJoin(chatGroups, eq(chatGroups.id, viewerMembership.groupId))
      .where(
        and(
          eq(chatGroups.kind, 'group'),
          eq(viewerMembership.userId, actorId),
          eq(ownerMembership.userId, share.ownerId),
          lte(viewerMembership.joinedAt, share.sharedAt),
          lte(ownerMembership.joinedAt, share.sharedAt)
        )
      )
      .limit(1),
  ]);

  const visibleInGroup = groupRows.some(
    (row) =>
      share.sharedAt >= row.viewerJoinedAt &&
      share.sharedAt >= row.ownerJoinedAt
  );
  return Boolean(friendRows[0] || visibleInGroup);
}
