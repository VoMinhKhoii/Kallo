// ---------------------------------------------------------------------------
// Shared "most-recent shared meal per user, today" query
// ---------------------------------------------------------------------------
// Used by lib/actions/groups/feed.ts (listCircleFeed and listFriendsThreadFeed,
// both scoped to the actor's friend graph). The group feeds build on the shared
// projection below from group-meals.ts. A friend's share is visible only when
// it was made at or after the friendship was accepted — friendSinceSql, the
// same predicate the share-by-id gate uses.
//
// Two clocks, never swapped. WHERE a meal sits — its day, its order, the
// "today" window — is when it was EATEN (meal_shares.eaten_at, the trigger-kept
// copy of meals.logged_at that the feed indexes cover): a meal logged for
// yesterday belongs under Yesterday, not Today. WHO may see it and whether it
// is unread is when it was SHARED (meal_shares.shared_at), because that is when
// it reached anyone. The history feeds still serve share order by default
// (FeedOrder): installed apps group day dividers by sharedAt over whatever
// order they receive, so only a client that asks for 'eaten' gets eaten order.

import { and, desc, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { toLocalDayKey } from '@/lib/core/date/day-key';
import {
  encodeSharedMealCursor,
  type SharedMealCursor,
} from '@/lib/domain/social/feed/cursor';
import {
  type PublicIdentity,
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/domain/social/identity/public-identity';
import type { ShareReactions } from '@/lib/domain/social/shares/reactions';
import type {
  ShareRepliesSummary,
  ShareReply,
} from '@/lib/domain/social/shares/replies';
import { friendSinceSql } from '@/lib/domain/social/shares/share-visibility';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import { mealShares, meals, publicProfiles } from '@/lib/infra/db/schema';

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
  /** 'precise' | 'cheat'. A cheat meal has no item rows, so it cannot be
   *  copied off the wall — the clients read this to hide that action. */
  entryMode: string;
  sharedAt: Date;
  /** When the meal was eaten. Differs from sharedAt for a backfilled meal
   * (logged for a past date), letting the client hide its meaningless time. */
  loggedAt: Date;
  /** shared_at and eaten_at at full PostgreSQL timestamptz precision, used
   * only to construct cursors for the matching FeedOrder. */
  sharedAtText: string;
  eatenAtText: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
}

/** The one projection every shared-meal read selects. Exported so a
 * single-share lookup (share-lookup.ts) builds the identical SharedMealRow
 * instead of restating the column list and drifting from it. */
export const sharedMealColumns = {
  friendUserId: mealShares.actorId,
  mealId: meals.id,
  shareId: mealShares.id,
  rawInput: meals.rawInput,
  caloriesKcal: meals.caloriesKcal,
  proteinG: meals.proteinG,
  carbohydrateG: meals.carbohydrateG,
  fatG: meals.fatG,
  portionFactor: meals.portionFactor,
  entryMode: meals.entryMode,
  sharedAt: mealShares.sharedAt,
  loggedAt: meals.loggedAt,
  sharedAtText: sql<string>`${mealShares.sharedAt}::text`,
  eatenAtText: sql<string>`${mealShares.eatenAt}::text`,
  ...publicProfileColumns,
};

/** Local calendar date (YYYY-MM-DD) for a viewer's timezone offset. */
export function todayLocalDate(timezoneOffset: number): string {
  return toLocalDayKey(Date.now(), timezoneOffset);
}

/** The viewer's own shares, or a friend's share made after the two connected.
 * Folded into every friend-feed query so a newly accepted friend never sees the
 * backlog shared before the friendship existed. */
function visibleToViewer(viewerId: string) {
  return or(
    eq(mealShares.actorId, viewerId),
    friendSinceSql(viewerId, mealShares.actorId, mealShares.sharedAt)
  );
}

/** Which clock a history feed is ordered and paged by — see the header. */
export type FeedOrder = 'shared' | 'eaten';

/** Each order's clock; both have a matching meal_shares_(actor_)*_id_idx. */
const FEED_CLOCK = {
  shared: mealShares.sharedAt,
  eaten: mealShares.eatenAt,
} as const;

/** Rows strictly after `before` in `order`, newest first, ties broken by
 * share id. `undefined` (no bound) for the first page. A cursor is only ever
 * read back under the order that issued it: the client pages one feed with
 * one order. */
export function feedBeforeCursor(
  order: FeedOrder,
  before: SharedMealCursor | null
) {
  if (!before) return undefined;
  const clock = FEED_CLOCK[order];
  return or(
    sql`${clock} < ${before.ts}::timestamptz`,
    and(sql`${clock} = ${before.ts}::timestamptz`, lt(mealShares.id, before.id))
  );
}

/** The order `feedBeforeCursor` seeks through. */
export function feedNewestFirst(order: FeedOrder) {
  return [desc(FEED_CLOCK[order]), desc(mealShares.id)];
}

/** The cursor that resumes after `row` in `order`. */
export function feedCursorAfter(order: FeedOrder, row: SharedMealRow): string {
  return encodeSharedMealCursor({
    ts: order === 'eaten' ? row.eatenAtText : row.sharedAtText,
    id: row.shareId,
  });
}

/**
 * When the newest share from a friend that the viewer may see was made — what
 * the Friends unread dot compares with the read marker, and what opening the
 * feed advances that marker to. Not taken from a feed page: pages run in eaten
 * order, so a meal logged for last week but shared just now can sit pages
 * down, and a marker read off page one would leave it unread forever. Read it
 * BEFORE the page, so it never counts a share that page could not have seen.
 */
export async function newestFriendSharedAt(
  viewerId: string,
  db: Db = defaultDb
): Promise<Date | null> {
  const [row] = await db
    .select({ sharedAt: mealShares.sharedAt })
    .from(mealShares)
    .where(
      and(
        ne(mealShares.actorId, viewerId),
        sql`${mealShares.visibility} <> 'private'`,
        friendSinceSql(viewerId, mealShares.actorId, mealShares.sharedAt)
      )
    )
    .orderBy(desc(mealShares.sharedAt))
    .limit(1);
  return row?.sharedAt ?? null;
}

/**
 * Most-recent non-private shared meal per user EATEN within [dayStart, dayEnd).
 * A meal logged for yesterday and shared today is not today's meal. Callers
 * scope `userIds` to the viewer plus their accepted friends; the query
 * additionally drops any friend share made before that friendship was
 * accepted, so "most recent" means most recent the viewer may see.
 */
export async function mostRecentSharedMealsToday(
  viewerId: string,
  userIds: string[],
  dayStart: Date,
  dayEnd: Date,
  db: Db = defaultDb
): Promise<SharedMealRow[]> {
  if (userIds.length === 0) return [];

  return (
    db
      .selectDistinctOn([mealShares.actorId], sharedMealColumns)
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
          visibleToViewer(viewerId),
          gte(mealShares.eatenAt, dayStart),
          lt(mealShares.eatenAt, dayEnd)
        )
      )
      // DISTINCT ON requires the leading ORDER BY to match the distinct key.
      .orderBy(mealShares.actorId, ...feedNewestFirst('eaten'))
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
 * Seek-paginated Friends history: every non-private share from the actor, or
 * from a live accepted friend made after the friendship was accepted,
 * newest first by `order`'s clock.
 * Friendship authorization is part of this query so the owner-role connection
 * never fetches an unscoped share.
 */
export async function sharedMealsBefore(
  actorId: string,
  before: SharedMealCursor | null,
  db: Db = defaultDb,
  limit = THREAD_PAGE_SIZE,
  order: FeedOrder = 'shared'
): Promise<SharedMealPage> {
  // Fetch one extra row so hasMore/nextCursor is known from a single
  // round trip instead of a separate count query.
  const rows = await db
    .select(sharedMealColumns)
    .from(mealShares)
    .innerJoin(
      meals,
      and(eq(meals.id, mealShares.mealId), eq(meals.userId, mealShares.actorId))
    )
    .innerJoin(publicProfiles, eq(publicProfiles.userId, mealShares.actorId))
    .where(
      and(
        visibleToViewer(actorId),
        sql`${mealShares.visibility} <> 'private'`,
        feedBeforeCursor(order, before)
      )
    )
    .orderBy(...feedNewestFirst(order))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    rows: page,
    nextCursor: hasMore && last ? feedCursorAfter(order, last) : null,
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
    /** 'precise' | 'cheat' — see SharedMealRow.entryMode. */
    entryMode: string;
    sharedAt: string;
    /** When the meal was eaten. A client that asks for the 'eaten' order
     * day-groups by this. */
    loggedAt: string;
    /** True when the meal was logged for a PAST date (backfilled), so its
     * share-time ("just now") would be misleading and the UI hides it.
     * Computed server-side and timezone-independently — see isBackfilledShare. */
    isBackfilled: boolean;
  };
  reactions: ShareReactions;
  replies: ShareReply[];
  repliesTotal: number;
}

// A meal's loggedAt is the chosen local date stamped with the time-of-day at
// which it was analyzed (see getUtcInstantForLocalDate), i.e. exactly N days
// before that analysis instant. sharedAt is set (~now) when it's saved/shared,
// always at or after analysis. So sharedAt − loggedAt ≈ N×24h + a small
// analyze→confirm gap: a real-time log is minutes apart, a past-date backfill is
// ≥ ~24h apart. Thresholding the gap detects backfills WITHOUT any timezone —
// no viewer/owner-tz ambiguity, no stored offset. 18h sits safely between the
// two (well under the ~23–24h backfill floor even across a DST shift, well over
// any realistic same-day analyze→confirm delay).
const BACKFILL_MIN_GAP_MS = 18 * 60 * 60 * 1000;

export function isBackfilledShare(loggedAt: Date, sharedAt: Date): boolean {
  return sharedAt.getTime() - loggedAt.getTime() >= BACKFILL_MIN_GAP_MS;
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
      entryMode: row.entryMode,
      sharedAt: row.sharedAt.toISOString(),
      loggedAt: row.loggedAt.toISOString(),
      isBackfilled: isBackfilledShare(row.loggedAt, row.sharedAt),
    },
    reactions,
    replies: replySummary.replies,
    repliesTotal: replySummary.total,
  };
}
