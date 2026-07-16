// Circle list/feed service functions. SECURITY: the Drizzle db handle bypasses RLS —
// every query must carry an explicit actor predicate (see ./types.ts).

import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import { db as defaultDb } from '@/lib/db';
import {
  friendships,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import { circleFeedSchema } from '@/lib/validation';

import {
  CIRCLE_FEED_FRIEND_CAP,
  type CircleFeedEntry,
  type CircleMember,
  type Db,
} from './types';

// ---------------------------------------------------------------------------
// listCircle — the actor's friendships joined to public profiles
// ---------------------------------------------------------------------------

export async function listCircle(
  actorId: string,
  db: Db = defaultDb
): Promise<CircleMember[]> {
  const rows = await db
    .select({
      friendshipId: friendships.id,
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      userLow: friendships.userLow,
      userHigh: friendships.userHigh,
      profileUserId: publicProfiles.userId,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(friendships)
    .innerJoin(
      publicProfiles,
      // Join to the OTHER party's profile.
      sql`${publicProfiles.userId} = CASE WHEN ${friendships.userLow} = ${actorId} THEN ${friendships.userHigh} ELSE ${friendships.userLow} END`
    )
    .where(
      and(
        or(eq(friendships.userLow, actorId), eq(friendships.userHigh, actorId)),
        sql`${friendships.status} <> 'blocked'`
      )
    )
    .orderBy(desc(friendships.updatedAt));

  return rows.map((r) => {
    let direction: CircleMember['direction'] = null;
    if (r.status === 'pending') {
      direction = r.requestedBy === actorId ? 'outgoing' : 'incoming';
    }
    return {
      friendshipId: r.friendshipId,
      status: r.status,
      direction,
      profile: {
        userId: r.profileUserId,
        handle: r.handle,
        displayName: r.displayName,
        avatarSeed: r.avatarSeed,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// listCircleFeed — most-recent shared meal per friend, today, capped + deduped
// ---------------------------------------------------------------------------

export async function listCircleFeed(
  actorId: string,
  input: { timezoneOffset: number },
  db: Db = defaultDb
): Promise<CircleFeedEntry[]> {
  const parsed = circleFeedSchema.parse(input);

  // Per-viewer local "today" window (matches the logging surface).
  const today = todayLocalDate(parsed.timezoneOffset);
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    today,
    parsed.timezoneOffset
  );

  // Resolve the actor's accepted friends, most-recently-connected first so the
  // cap below is deterministic (not arbitrary physical row order).
  const friendRows = await db
    .select({
      userLow: friendships.userLow,
      userHigh: friendships.userHigh,
    })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.userLow, actorId), eq(friendships.userHigh, actorId)),
        eq(friendships.status, 'accepted')
      )
    )
    .orderBy(desc(friendships.updatedAt));

  const friendIds = friendRows.map((r) =>
    r.userLow === actorId ? r.userHigh : r.userLow
  );

  // Cap the number of FRIENDS considered (non-scrollable ambient wall). The
  // actor is always included beyond the cap so they keep their own table even
  // with a full circle — presence without your own presence is surveillance.
  const cappedFriendIds = friendIds.slice(0, CIRCLE_FEED_FRIEND_CAP);
  const queryUserIds = [actorId, ...cappedFriendIds];

  // Most-recent shared ('circle' or 'public') meal per user within today —
  // the actor plus their (capped) friends. Self-inclusion stays userId-scoped:
  // a user only ever sees their own meal and meals of users they are accepted
  // friends with (the friendIds set is derived from accepted edges above).
  const rows = await db
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
    })
    .from(mealShares)
    .innerJoin(meals, eq(meals.id, mealShares.mealId))
    .innerJoin(publicProfiles, eq(publicProfiles.userId, meals.userId))
    .where(
      and(
        inArray(meals.userId, queryUserIds),
        sql`${mealShares.visibility} <> 'private'`,
        gte(mealShares.sharedAt, dayStart),
        lt(mealShares.sharedAt, dayEnd)
      )
    )
    // DISTINCT ON requires the leading ORDER BY to match the distinct key.
    .orderBy(meals.userId, desc(mealShares.sharedAt));

  const entries = rows.map((r) => ({
    friend: {
      userId: r.friendUserId,
      handle: r.handle,
      displayName: r.displayName,
      avatarSeed: r.avatarSeed,
    },
    isSelf: r.friendUserId === actorId,
    meal: {
      mealId: r.mealId,
      shareId: r.shareId,
      rawInput: r.rawInput,
      caloriesKcal: r.caloriesKcal,
      proteinG: r.proteinG,
      carbohydrateG: r.carbohydrateG,
      fatG: r.fatG,
      sharedAt: r.sharedAt.toISOString(),
    },
  }));

  // The actor's own table is the first slot; friends follow newest-first.
  const self = entries.filter((e) => e.isSelf);
  const friends = entries
    .filter((e) => !e.isSelf)
    .sort(
      (a, b) =>
        new Date(b.meal.sharedAt).getTime() -
        new Date(a.meal.sharedAt).getTime()
    );
  return [...self, ...friends];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Local calendar date (YYYY-MM-DD) for a viewer's timezone offset. */
function todayLocalDate(timezoneOffset: number): string {
  const local = new Date(Date.now() - timezoneOffset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
