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
import { toLocalDayKey } from '@/lib/date/day-key';
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
} from '@/lib/social/feed/cursor';
import {
  type PublicIdentity,
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/social/identity/public-identity';
import type { ShareReactions } from '@/lib/social/shares/reactions';
import type {
  ShareRepliesSummary,
  ShareReply,
} from '@/lib/social/shares/replies';

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
  /** When the meal was eaten. Differs from sharedAt for a backfilled meal
   * (logged for a past date), letting the client hide its meaningless time. */
  loggedAt: Date;
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
  return toLocalDayKey(Date.now(), timezoneOffset);
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
        loggedAt: meals.loggedAt,
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
      loggedAt: meals.loggedAt,
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
      sharedAt: row.sharedAt.toISOString(),
      isBackfilled: isBackfilledShare(row.loggedAt, row.sharedAt),
    },
    reactions,
    replies: replySummary.replies,
    repliesTotal: replySummary.total,
  };
}
