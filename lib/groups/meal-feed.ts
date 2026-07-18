// ---------------------------------------------------------------------------
// Shared "most-recent shared meal per user, today" query
// ---------------------------------------------------------------------------
// Used by both lib/actions/groups.ts (listCircleFeed — scoped to the actor's
// friend graph) and lib/actions/chat-groups.ts (listGroupMealFeed — scoped to
// a chat group's membership). Lives in neither action module so both can
// import it without creating a circular dependency between them.

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import {
  friendships,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import {
  encodeSharedMealCursor,
  type SharedMealCursor,
} from '@/lib/groups/feed/cursor';
import {
  type PublicIdentity,
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/groups/public-identity';
import type { ShareReactions } from '@/lib/groups/shares/reactions';
import type {
  ShareRepliesSummary,
  ShareReply,
} from '@/lib/groups/shares/replies';

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
  /** Full PostgreSQL timestamptz precision used only to construct cursors. */
  sharedAtText: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  avatarUrl: string | null;
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
      .selectDistinctOn([mealShares.actorId], {
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
        sharedAtText: sql<string>`${mealShares.sharedAt}::text`,
        ...publicProfileColumns,
      })
      .from(mealShares)
      .innerJoin(
        meals,
        and(
          eq(meals.id, mealShares.mealId),
          eq(meals.userId, mealShares.actorId)
        )
      )
      .innerJoin(publicProfiles, eq(publicProfiles.userId, mealShares.actorId))
      .where(
        and(
          inArray(mealShares.actorId, userIds),
          sql`${mealShares.visibility} <> 'private'`,
          gte(mealShares.sharedAt, dayStart),
          lt(mealShares.sharedAt, dayEnd)
        )
      )
      // DISTINCT ON requires the leading ORDER BY to match the distinct key.
      .orderBy(
        mealShares.actorId,
        desc(mealShares.sharedAt),
        desc(mealShares.id)
      )
  );
}

/** One page of a thread's shared-meal history — every share, not collapsed
 * per user. Pass the opaque `nextCursor` back as `before`; `null` means the
 * history is exhausted. */
export interface SharedMealPage {
  rows: SharedMealRow[];
  nextCursor: string | null;
}

const THREAD_PAGE_SIZE = 20;

/**
 * Seek-paginated Friends history: every non-private share from the actor or a
 * live accepted friend, newest-first. Friendship authorization is joined into
 * this query so the owner-role connection never fetches an unscoped share.
 */
export async function sharedMealsBefore(
  actorId: string,
  before: SharedMealCursor | null,
  db: Db = defaultDb,
  limit = THREAD_PAGE_SIZE
): Promise<SharedMealPage> {
  // Fetch one extra row so hasMore/nextCursor is known from a single
  // round trip instead of a separate count query.
  const rows = await db
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
      sharedAtText: sql<string>`${mealShares.sharedAt}::text`,
      ...publicProfileColumns,
    })
    .from(mealShares)
    .innerJoin(
      meals,
      and(eq(meals.id, mealShares.mealId), eq(meals.userId, mealShares.actorId))
    )
    .innerJoin(publicProfiles, eq(publicProfiles.userId, mealShares.actorId))
    .leftJoin(
      friendships,
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.userLow, actorId),
            eq(friendships.userHigh, mealShares.actorId)
          ),
          and(
            eq(friendships.userHigh, actorId),
            eq(friendships.userLow, mealShares.actorId)
          )
        )
      )
    )
    .where(
      and(
        or(eq(mealShares.actorId, actorId), isNotNull(friendships.id)),
        sql`${mealShares.visibility} <> 'private'`,
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
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    rows: page,
    nextCursor:
      hasMore && last
        ? encodeSharedMealCursor({ ts: last.sharedAtText, id: last.shareId })
        : null,
  };
}

export interface SharedMealEntry {
  friend: PublicIdentity;
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
  replies: ShareReply[];
  repliesTotal: number;
}

/** Shared row → entry projection, reused by listCircleFeed, listFriendsThreadFeed,
 * and listGroupMealFeed so the shape only lives in one place. */
export function toSharedMealEntry(
  row: SharedMealRow,
  actorId: string,
  reactions: ShareReactions = { count: 0, mine: false },
  replySummary: ShareRepliesSummary = { replies: [], total: 0 }
): SharedMealEntry {
  return {
    friend: toPublicIdentity({
      userId: row.friendUserId,
      handle: row.handle,
      displayName: row.displayName,
      avatarSeed: row.avatarSeed,
      avatarUrl: row.avatarUrl,
      avatarPath: row.avatarPath,
    }),
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
    replies: replySummary.replies,
    repliesTotal: replySummary.total,
  };
}
