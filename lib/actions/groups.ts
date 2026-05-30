// ---------------------------------------------------------------------------
// Group tracking — profile / friendship / feed service functions
// ---------------------------------------------------------------------------
// Pure, dependency-light async functions. Each takes the authenticated actor's
// id plus an optional Drizzle `db` handle (defaulting to the app singleton) so
// the REST routes and tests can call them directly. RLS is the source of truth
// at the DB layer; these functions add app-layer `WHERE actor = ...` checks as
// defense-in-depth and shape the response for the client.

import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import { db as defaultDb } from '@/lib/db';
import {
  circleEvents,
  friendships,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { orderedPair } from '@/lib/groups/friendship';
import { validateHandle } from '@/lib/groups/handles';
import {
  acceptFriendSchema,
  blockFriendSchema,
  circleFeedSchema,
  requestFriendSchema,
  searchByHandleSchema,
  upsertPublicProfileSchema,
} from '@/lib/validation';

type Db = typeof defaultDb;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface PublicProfile {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
}

export interface CircleMember {
  friendshipId: string;
  status: string;
  /** Direction of a pending request relative to the actor. */
  direction: 'incoming' | 'outgoing' | null;
  profile: PublicProfile;
}

export interface CircleFeedEntry {
  friend: {
    userId: string;
    handle: string;
    displayName: string | null;
    avatarSeed: string | null;
  };
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

/** Hard cap on the ambient wall: top friends, last 24h, non-scrollable. */
export const CIRCLE_FEED_FRIEND_CAP = 20;

// ---------------------------------------------------------------------------
// upsertPublicProfile
// ---------------------------------------------------------------------------

export async function upsertPublicProfile(
  actorId: string,
  input: { handle: string; displayName?: string; avatarSeed?: string },
  db: Db = defaultDb
): Promise<PublicProfile> {
  const parsed = upsertPublicProfileSchema.parse(input);

  // Reserved-handle blocklist (distinct rejection reason from shape validation).
  const checked = validateHandle(parsed.handle);
  if (!checked.valid) {
    throw Errors.validationFailed(
      checked.error === 'reserved'
        ? 'Handle này đã được giữ chỗ.'
        : 'Handle không hợp lệ.'
    );
  }
  const handle = checked.handle;

  // Reject if the handle is taken by someone else (case-insensitive — stored
  // lowercased). The unique index is the ultimate guard; this gives a clean error.
  const existing = await db
    .select({ userId: publicProfiles.userId })
    .from(publicProfiles)
    .where(eq(publicProfiles.handle, handle))
    .limit(1);
  if (existing[0] && existing[0].userId !== actorId) {
    throw Errors.conflict('Handle này đã được sử dụng.');
  }

  const [row] = await db
    .insert(publicProfiles)
    .values({
      userId: actorId,
      handle,
      displayName: parsed.displayName ?? null,
      avatarSeed: parsed.avatarSeed ?? null,
    })
    .onConflictDoUpdate({
      target: publicProfiles.userId,
      set: {
        handle,
        displayName: parsed.displayName ?? null,
        avatarSeed: parsed.avatarSeed ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    avatarSeed: row.avatarSeed,
  };
}

// ---------------------------------------------------------------------------
// searchByHandle — EXACT match only (not enumerable / no prefix)
// ---------------------------------------------------------------------------

export async function searchByHandle(
  actorId: string,
  input: { handle: string },
  db: Db = defaultDb
): Promise<PublicProfile | null> {
  const parsed = searchByHandleSchema.parse(input);

  const rows = await db
    .select({
      userId: publicProfiles.userId,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.handle, parsed.handle))
    .limit(1);

  const match = rows[0];
  if (!match || match.userId === actorId) {
    // Never reveal the actor's own profile via search, and never leak a "no
    // such handle" vs "is you" distinction — both return null.
    return null;
  }

  return match;
}

// ---------------------------------------------------------------------------
// requestFriend — compute orderedPair, insert pending, write event
// ---------------------------------------------------------------------------

export async function requestFriend(
  actorId: string,
  input: { targetUserId: string },
  db: Db = defaultDb
): Promise<{ friendshipId: string; status: string }> {
  const parsed = requestFriendSchema.parse(input);

  if (parsed.targetUserId === actorId) {
    throw Errors.validationFailed('Không thể kết bạn với chính mình.');
  }

  const { userLow, userHigh } = orderedPair(actorId, parsed.targetUserId);

  // If an edge already exists (pending/accepted/blocked), surface it rather
  // than violating the composite unique.
  const existing = await db
    .select({ id: friendships.id, status: friendships.status })
    .from(friendships)
    .where(
      and(
        eq(friendships.userLow, userLow),
        eq(friendships.userHigh, userHigh)
      )
    )
    .limit(1);

  if (existing[0]) {
    if (existing[0].status === 'blocked') {
      throw Errors.conflict('Không thể gửi lời mời kết bạn.');
    }
    return { friendshipId: existing[0].id, status: existing[0].status };
  }

  const [row] = await db
    .insert(friendships)
    .values({
      userLow,
      userHigh,
      requestedBy: actorId,
      status: 'pending',
    })
    .returning({ id: friendships.id, status: friendships.status });

  // Event spine: the meal-share fanout is handled by a DB trigger, but
  // friend_request has no trigger, so write it here.
  await db.insert(circleEvents).values({
    actorId,
    type: 'friend_request',
    refId: row.id,
  });

  return { friendshipId: row.id, status: row.status };
}

// ---------------------------------------------------------------------------
// acceptFriend — accepter must NOT be the requester
// ---------------------------------------------------------------------------

export async function acceptFriend(
  actorId: string,
  input: { friendshipId: string },
  db: Db = defaultDb
): Promise<{ friendshipId: string; status: string }> {
  const parsed = acceptFriendSchema.parse(input);

  const [row] = await db
    .update(friendships)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(
      and(
        eq(friendships.id, parsed.friendshipId),
        eq(friendships.status, 'pending'),
        // Only the recipient (not the requester) may accept.
        sql`${friendships.requestedBy} <> ${actorId}`,
        or(
          eq(friendships.userLow, actorId),
          eq(friendships.userHigh, actorId)
        )
      )
    )
    .returning({ id: friendships.id, status: friendships.status });

  if (!row) {
    throw Errors.notFound('Lời mời không tồn tại hoặc không thể chấp nhận.');
  }

  await db.insert(circleEvents).values({
    actorId,
    type: 'friend_accepted',
    refId: row.id,
  });

  return { friendshipId: row.id, status: row.status };
}

// ---------------------------------------------------------------------------
// blockFriend
// ---------------------------------------------------------------------------

export async function blockFriend(
  actorId: string,
  input: { targetUserId: string },
  db: Db = defaultDb
): Promise<{ friendshipId: string; status: string }> {
  const parsed = blockFriendSchema.parse(input);

  if (parsed.targetUserId === actorId) {
    throw Errors.validationFailed('Không thể chặn chính mình.');
  }

  const { userLow, userHigh } = orderedPair(actorId, parsed.targetUserId);

  const [row] = await db
    .insert(friendships)
    .values({
      userLow,
      userHigh,
      requestedBy: actorId,
      status: 'blocked',
    })
    .onConflictDoUpdate({
      target: [friendships.userLow, friendships.userHigh],
      set: { status: 'blocked', updatedAt: new Date() },
    })
    .returning({ id: friendships.id, status: friendships.status });

  return { friendshipId: row.id, status: row.status };
}

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
        or(
          eq(friendships.userLow, actorId),
          eq(friendships.userHigh, actorId)
        ),
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

  // Resolve the actor's accepted friends.
  const friendRows = await db
    .select({
      userLow: friendships.userLow,
      userHigh: friendships.userHigh,
    })
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.userLow, actorId),
          eq(friendships.userHigh, actorId)
        ),
        eq(friendships.status, 'accepted')
      )
    );

  const friendIds = friendRows.map((r) =>
    r.userLow === actorId ? r.userHigh : r.userLow
  );
  if (friendIds.length === 0) return [];

  // Cap the number of friends considered (non-scrollable ambient wall).
  const cappedFriendIds = friendIds.slice(0, CIRCLE_FEED_FRIEND_CAP);

  // Most-recent shared ('circle' or 'public') meal per friend within today.
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
        inArray(meals.userId, cappedFriendIds),
        sql`${mealShares.visibility} <> 'private'`,
        gte(mealShares.sharedAt, dayStart),
        lt(mealShares.sharedAt, dayEnd)
      )
    )
    // DISTINCT ON requires the leading ORDER BY to match the distinct key.
    .orderBy(meals.userId, desc(mealShares.sharedAt));

  // Order the deduped rows newest-first for display.
  const sorted = rows.sort(
    (a, b) => b.sharedAt.getTime() - a.sharedAt.getTime()
  );

  return sorted.map((r) => ({
    friend: {
      userId: r.friendUserId,
      handle: r.handle,
      displayName: r.displayName,
      avatarSeed: r.avatarSeed,
    },
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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Local calendar date (YYYY-MM-DD) for a viewer's timezone offset. */
function todayLocalDate(timezoneOffset: number): string {
  const local = new Date(Date.now() - timezoneOffset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
