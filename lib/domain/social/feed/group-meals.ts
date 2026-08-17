import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { SharedMealCursor } from '@/lib/domain/social/feed/cursor';
import type { SharedMealRow } from '@/lib/domain/social/feed/meal-feed';
import { publicProfileColumns } from '@/lib/domain/social/identity/public-identity';
import type { AppDb, AppTransaction } from '@/lib/infra/db';
import { db as defaultDb } from '@/lib/infra/db';
import {
  chatGroupMembers,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';

type Db = AppDb | AppTransaction;

interface GroupSharedMealRow extends SharedMealRow {
  ownerJoinedAt: Date;
  visibilitySharedAt: Date;
}

/** Group-scoped shared meals. Both post-join bounds run in SQL before LIMIT;
 * the in-memory repeat protects test doubles and future query refactors. */
export async function sharedGroupMealsBefore(
  groupId: string,
  viewerId: string,
  viewerJoinedAt: Date,
  before: SharedMealCursor | null,
  db: Db = defaultDb,
  limit = 20
): Promise<SharedMealRow[]> {
  const ownerMembership = alias(chatGroupMembers, 'meal_owner_membership');
  const viewerMembership = alias(chatGroupMembers, 'meal_viewer_membership');
  const rows: GroupSharedMealRow[] = await db
    .select({
      friendUserId: mealShares.actorId,
      mealId: meals.id,
      shareId: mealShares.id,
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
      portionFactor: meals.portionFactor,
      sharedAt: mealShares.sharedAt,
      loggedAt: meals.loggedAt,
      sharedAtText: sql<string>`${mealShares.sharedAt}::text`,
      ...publicProfileColumns,
      ownerJoinedAt: ownerMembership.joinedAt,
      visibilitySharedAt: mealShares.sharedAt,
    })
    .from(mealShares)
    .innerJoin(
      meals,
      and(eq(meals.id, mealShares.mealId), eq(meals.userId, mealShares.actorId))
    )
    .innerJoin(publicProfiles, eq(publicProfiles.userId, mealShares.actorId))
    .innerJoin(
      viewerMembership,
      and(
        eq(viewerMembership.groupId, groupId),
        eq(viewerMembership.userId, viewerId)
      )
    )
    .innerJoin(
      ownerMembership,
      and(
        eq(ownerMembership.groupId, groupId),
        eq(ownerMembership.userId, mealShares.actorId)
      )
    )
    .where(
      and(
        sql`${mealShares.visibility} <> 'private'`,
        gte(mealShares.sharedAt, viewerMembership.joinedAt),
        gte(mealShares.sharedAt, ownerMembership.joinedAt),
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

  return rows
    .filter(
      (row) =>
        row.visibilitySharedAt >= viewerJoinedAt &&
        row.visibilitySharedAt >= row.ownerJoinedAt
    )
    .map(
      ({
        ownerJoinedAt: _ownerJoinedAt,
        visibilitySharedAt: _visibilitySharedAt,
        ...row
      }) => row
    );
}
