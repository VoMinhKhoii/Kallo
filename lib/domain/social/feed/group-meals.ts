import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { SharedMealCursor } from '@/lib/domain/social/feed/cursor';
import {
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

/** Group-scoped shared meals, newest first. Admission is `groupShareVisibleSql`
 * — the one group-share rule (not private, not blocked, both members joined
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
        before
          ? or(
              sql`${mealShares.sharedAt} < ${before.ts}::timestamptz`,
              and(
                sql`${mealShares.sharedAt} = ${before.ts}::timestamptz`,
                lt(mealShares.id, before.id)
              )
            )
          : undefined
      )
    )
    .orderBy(desc(mealShares.sharedAt), desc(mealShares.id))
    .limit(limit);
}
