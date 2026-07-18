// ---------------------------------------------------------------------------
// Shared "most-recent shared meal per user, today" query
// ---------------------------------------------------------------------------
// Used by both lib/actions/groups.ts (listCircleFeed — scoped to the actor's
// friend graph) and lib/actions/chat-groups.ts (listGroupMealFeed — scoped to
// a chat group's membership). Lives in neither action module so both can
// import it without creating a circular dependency between them.

import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import { mealShares, meals, publicProfiles } from '@/lib/db/schema';
import { avatarUrlFor } from '@/lib/groups/avatar-url';

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
  sharedAt: Date;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  avatarPath: string | null;
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
        sharedAt: mealShares.sharedAt,
        handle: publicProfiles.handle,
        displayName: publicProfiles.displayName,
        avatarSeed: publicProfiles.avatarSeed,
        avatarPath: publicProfiles.avatarPath,
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
      sharedAt: mealShares.sharedAt,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
      avatarPath: publicProfiles.avatarPath,
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

export interface SharedMealEntry {
  friend: {
    userId: string;
    handle: string;
    displayName: string | null;
    avatarSeed: string | null;
    avatarUrl: string | null;
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
    sharedAt: string;
  };
}

/** Shared row → entry projection, reused by listCircleFeed, listFriendsThreadFeed,
 * and listGroupMealFeed so the shape only lives in one place. */
export function toSharedMealEntry(
  row: SharedMealRow,
  actorId: string
): SharedMealEntry {
  return {
    friend: {
      userId: row.friendUserId,
      handle: row.handle,
      displayName: row.displayName,
      avatarSeed: row.avatarSeed,
      avatarUrl: avatarUrlFor(row.avatarPath),
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
      sharedAt: row.sharedAt.toISOString(),
    },
  };
}
