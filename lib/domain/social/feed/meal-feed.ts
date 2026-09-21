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
import { toLocalDayKey } from '@/lib/core/date/day-key';
import {
  type CheatRecapRow,
  toCheatRecap,
} from '@/lib/domain/cheat/feed-recap';
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
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  friendships,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';

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
  /** Ethanol grams. The one calorie source the P/C/F line cannot hold, and
   *  the figure a drink-heavy cheat occasion is mostly made of. */
  alcoholG: number | null;
  /** Raw `cheat_sliders` JSONB. Resolved to a compact recap by
   *  `toSharedMealEntry` and never sent to a client as-is — see feed-recap.ts. */
  cheatSliders: unknown;
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
  alcoholG: meals.alcoholG,
  cheatSliders: meals.cheatSliders,
  sharedAt: mealShares.sharedAt,
  loggedAt: meals.loggedAt,
  sharedAtText: sql<string>`${mealShares.sharedAt}::text`,
  ...publicProfileColumns,
};

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
    .select(sharedMealColumns)
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
    /** 'precise' | 'cheat' — see SharedMealRow.entryMode. */
    entryMode: string;
    alcoholG: number | null;
    /** Where the logger put each slider, for a cheat post. Null on a precise
     *  meal, and null on a cheat meal whose slider payload is unusable. */
    cheatRecap: CheatRecapRow[] | null;
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
      entryMode: row.entryMode,
      alcoholG: row.alcoholG,
      // Resolved here, not in the query: one place turns a stored payload into
      // what a friend sees, so the feed, the thread page and a single-share
      // lookup cannot drift apart.
      cheatRecap:
        row.entryMode === 'cheat' ? toCheatRecap(row.cheatSliders) : null,
      sharedAt: row.sharedAt.toISOString(),
      isBackfilled: isBackfilledShare(row.loggedAt, row.sharedAt),
    },
    reactions,
    replies: replySummary.replies,
    repliesTotal: replySummary.total,
  };
}
