import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { SharedMealCursor } from '@/lib/domain/social/feed/cursor';
import {
  eatenBeforeCursor,
  eatenNewestFirst,
  type SharedMealRow,
  sharedMealColumns,
} from '@/lib/domain/social/feed/meal-feed';
import { groupShareVisibleSql } from '@/lib/domain/social/shares/share-visibility';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

/** Group-scoped shared meals, newest-EATEN first (see meal-feed.ts). Admission
 * is `groupShareVisibleSql` — the one group-share rule (not private, not blocked, both members joined
 * before the share) — evaluated in SQL before LIMIT. The owner-membership join
 * only drives the scan from this group's members. */
export async function sharedGroupMealsBefore(
  groupId: string,
  viewerId: string,
  before: SharedMealCursor | null,
  db: Db = defaultDb,
  limit = 20
): Promise<SharedMealRow[]> {
  const ownerMembership = alias(chatGroupMembers, 'meal_owner_membership');
  return db
    .select(sharedMealColumns)
    .from(mealShares)
    .innerJoin(
      meals,
      and(eq(meals.id, mealShares.mealId), eq(meals.userId, mealShares.actorId))
    )
    .innerJoin(publicProfiles, eq(publicProfiles.userId, mealShares.actorId))
    .innerJoin(
      ownerMembership,
      and(
        eq(ownerMembership.groupId, groupId),
        eq(ownerMembership.userId, mealShares.actorId)
      )
    )
    .where(
      and(
        groupShareVisibleSql(viewerId, groupId, mealShares),
        eatenBeforeCursor(before)
      )
    )
    .orderBy(...eatenNewestFirst)
    .limit(limit);
}

/** When the newest share this viewer may see in the group was made — what
 * opening the group advances its read marker to. The same admission as the
 * group list's unread check (a member's share passing `groupShareVisibleSql`),
 * so the marker covers exactly what makes the group unread; see
 * `newestFriendSharedAt` for why a feed page cannot supply it. */
export async function newestGroupSharedAt(
  groupId: string,
  viewerId: string,
  db: Db = defaultDb
): Promise<Date | null> {
  const ownerMembership = alias(chatGroupMembers, 'meal_owner_membership');
  const [row] = await db
    .select({ sharedAt: mealShares.sharedAt })
    .from(mealShares)
    .innerJoin(
      ownerMembership,
      and(
        eq(ownerMembership.groupId, groupId),
        eq(ownerMembership.userId, mealShares.actorId)
      )
    )
    .where(groupShareVisibleSql(viewerId, groupId, mealShares))
    .orderBy(desc(mealShares.sharedAt))
    .limit(1);
  return row?.sharedAt ?? null;
}
