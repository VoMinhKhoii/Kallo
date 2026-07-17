// ---------------------------------------------------------------------------
// Shared "most-recent shared meal per user, today" query
// ---------------------------------------------------------------------------
// Used by both lib/actions/groups.ts (listCircleFeed — scoped to the actor's
// friend graph) and lib/actions/chat-groups.ts (listGroupMealFeed — scoped to
// a chat group's membership). Lives in neither action module so both can
// import it without creating a circular dependency between them.

import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppDb, AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import {
  chatGroupMembers,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import type { ShareReactions } from '@/lib/groups/shares/reactions';

type Db = AppDb | AppTransaction;

export interface SharedMealRow {
  friendUserId: string;
  mealId: string;
  shareId: string;
  rawInput: string;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  portionFactor: number;
  sharedAt: Date;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
}

/** Local calendar date (YYYY-MM-DD) for a viewer's timezone offset. */
export function todayLocalDate(timezoneOffset: number): string {
  const local = new Date(Date.now() - timezoneOffset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/**
 * Most-recent non-private shared meal per user, within [dayStart, dayEnd).
 * Callers are responsible for their own authorization scoping — this just
 * runs the query over whichever `userIds` they've already validated the
 * viewer is allowed to see.
 */
export async function mostRecentSharedMealsToday(
  userIds: string[],
  dayStart: Date,
  dayEnd: Date,
  db: Db = defaultDb
): Promise<SharedMealRow[]> {
  if (userIds.length === 0) return [];

  return (
    db
      .selectDistinctOn([meals.userId], {
        friendUserId: meals.userId,
        mealId: meals.id,
        shareId: mealShares.id,
        rawInput: meals.rawInput,
        caloriesKcal: meals.caloriesKcal,
        proteinG: meals.proteinG,
        carbohydrateG: meals.carbohydrateG,
        fatG: meals.fatG,
        portionFactor: meals.portionFactor,
        sharedAt: mealShares.sharedAt,
        handle: publicProfiles.handle,
        displayName: publicProfiles.displayName,
        avatarSeed: publicProfiles.avatarSeed,
      })
      .from(mealShares)
      .innerJoin(meals, eq(meals.id, mealShares.mealId))
      .innerJoin(publicProfiles, eq(publicProfiles.userId, meals.userId))
      .where(
        and(
          inArray(meals.userId, userIds),
          sql`${mealShares.visibility} <> 'private'`,
          gte(mealShares.sharedAt, dayStart),
          lt(mealShares.sharedAt, dayEnd)
        )
      )
      // DISTINCT ON requires the leading ORDER BY to match the distinct key.
      .orderBy(meals.userId, desc(mealShares.sharedAt))
  );
}

/** One page of a thread's shared-meal history — every share, not collapsed
 * per user. `nextCursor` is the oldest row's `sharedAt` (ISO), pass it back
 * as `before` to fetch the next page; `null` means history is exhausted. */
export interface SharedMealPage {
  rows: SharedMealRow[];
  nextCursor: string | null;
}

const THREAD_PAGE_SIZE = 20;

/**
 * Seek-paginated shared-meal history for a friend/group thread: every
 * non-private share among `userIds`, newest-first, strictly before `before`
 * (or unbounded when `before` is null — "today's or the latest" default
 * page). Unlike `mostRecentSharedMealsToday` this deliberately does NOT
 * collapse to one row per user — a thread shows every meal someone shared.
 */
export async function sharedMealsBefore(
  userIds: string[],
  before: Date | null,
  db: Db = defaultDb,
  limit = THREAD_PAGE_SIZE
): Promise<SharedMealPage> {
  if (userIds.length === 0) return { rows: [], nextCursor: null };

  // Fetch one extra row so hasMore/nextCursor is known from a single
  // round trip instead of a separate count query.
  const rows = await db
    .select({
      friendUserId: meals.userId,
      mealId: meals.id,
      shareId: mealShares.id,
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
      portionFactor: meals.portionFactor,
      sharedAt: mealShares.sharedAt,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(mealShares)
    .innerJoin(meals, eq(meals.id, mealShares.mealId))
    .innerJoin(publicProfiles, eq(publicProfiles.userId, meals.userId))
    .where(
      and(
        inArray(meals.userId, userIds),
        sql`${mealShares.visibility} <> 'private'`,
        before ? lt(mealShares.sharedAt, before) : undefined
      )
    )
    .orderBy(desc(mealShares.sharedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    rows: page,
    nextCursor: hasMore && last ? last.sharedAt.toISOString() : null,
  };
}

export interface SharedMealCursor {
  timestamp: Date;
  id: string;
}

interface GroupSharedMealRow extends SharedMealRow {
  ownerJoinedAt: Date;
  visibilitySharedAt: Date;
}

/**
 * Group-scoped variant of sharedMealsBefore used by the mixed timeline. The
 * SQL applies both post-join bounds before LIMIT (pagination cannot be filled
 * by hidden history), then the in-memory check repeats the invariant for test
 * doubles and defense against a future query refactor dropping either bound.
 */
export async function sharedGroupMealsBefore(
  groupId: string,
  viewerId: string,
  viewerJoinedAt: Date,
  before: SharedMealCursor | null,
  db: Db = defaultDb,
  limit = THREAD_PAGE_SIZE
): Promise<SharedMealRow[]> {
  const ownerMembership = alias(chatGroupMembers, 'meal_owner_membership');
  const viewerMembership = alias(chatGroupMembers, 'meal_viewer_membership');
  // postgres.js materializes timestamptz as a JavaScript Date (millisecond
  // precision). Seek on that same precision in SQL so rows with distinct
  // microseconds inside one millisecond fall back to the UUID tie-breaker
  // instead of disappearing behind a rounded cursor.
  const sharedAtMs = sql<Date>`date_trunc('milliseconds', ${mealShares.sharedAt})`;
  const rows: GroupSharedMealRow[] = await db
    .select({
      friendUserId: meals.userId,
      mealId: meals.id,
      shareId: mealShares.id,
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
      portionFactor: meals.portionFactor,
      sharedAt: sharedAtMs,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
      ownerJoinedAt: ownerMembership.joinedAt,
      visibilitySharedAt: mealShares.sharedAt,
    })
    .from(mealShares)
    .innerJoin(meals, eq(meals.id, mealShares.mealId))
    .innerJoin(publicProfiles, eq(publicProfiles.userId, meals.userId))
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
        eq(ownerMembership.userId, meals.userId)
      )
    )
    .where(
      and(
        sql`${mealShares.visibility} <> 'private'`,
        gte(mealShares.sharedAt, viewerMembership.joinedAt),
        gte(mealShares.sharedAt, ownerMembership.joinedAt),
        before
          ? or(
              lt(sharedAtMs, before.timestamp),
              and(
                eq(sharedAtMs, before.timestamp),
                lt(mealShares.id, before.id)
              )
            )
          : undefined
      )
    )
    .orderBy(desc(sharedAtMs), desc(mealShares.id))
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

export interface SharedMealEntry {
  friend: {
    userId: string;
    handle: string;
    displayName: string | null;
    avatarSeed: string | null;
  };
  isSelf: boolean;
  meal: {
    mealId: string;
    shareId: string;
    rawInput: string;
    caloriesKcal: number | null;
    proteinG: number | null;
    carbohydrateG: number | null;
    fatG: number | null;
    portionFactor: number;
    sharedAt: string;
  };
  reactions: ShareReactions;
}

/** Shared row → entry projection, reused by listCircleFeed, listFriendsThreadFeed,
 * and listGroupMealFeed so the shape only lives in one place. */
export function toSharedMealEntry(
  row: SharedMealRow,
  actorId: string,
  reactions: ShareReactions = { count: 0, mine: false }
): SharedMealEntry {
  return {
    friend: {
      userId: row.friendUserId,
      handle: row.handle,
      displayName: row.displayName,
      avatarSeed: row.avatarSeed,
    },
    isSelf: row.friendUserId === actorId,
    meal: {
      mealId: row.mealId,
      shareId: row.shareId,
      rawInput: row.rawInput,
      caloriesKcal: row.caloriesKcal,
      proteinG: row.proteinG,
      carbohydrateG: row.carbohydrateG,
      fatG: row.fatG,
      portionFactor: row.portionFactor,
      sharedAt: row.sharedAt.toISOString(),
    },
    reactions,
  };
}
