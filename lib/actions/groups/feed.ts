// Circle list/feed service functions. SECURITY: the Drizzle db handle bypasses RLS —
// every query must carry an explicit actor predicate (see ./types.ts).

import { and, desc, eq, or, sql } from 'drizzle-orm';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import { db as defaultDb } from '@/lib/db';
import {
  friendsFeedReadMarkers,
  friendships,
  publicProfiles,
} from '@/lib/db/schema';
import { decodeSharedMealCursor } from '@/lib/social/feed/cursor';
import {
  mostRecentSharedMealsToday,
  sharedMealsBefore,
  todayLocalDate,
  toSharedMealEntry,
} from '@/lib/social/feed/meal-feed';
import {
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/social/identity/public-identity';
import { reactionsForShares } from '@/lib/social/shares/reactions';
import { repliesForShares } from '@/lib/social/shares/replies';
import {
  circleFeedSchema,
  friendsThreadFeedSchema,
} from '@/lib/validation/social';

import {
  CIRCLE_FEED_FRIEND_CAP,
  type CircleFeedEntry,
  type CircleMember,
  type Db,
  type FriendsThreadFeedPage,
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
      ...publicProfileColumns,
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
      profile: toPublicIdentity({
        userId: r.profileUserId,
        handle: r.handle,
        displayName: r.displayName,
        avatarSeed: r.avatarSeed,
        avatarUrl: r.avatarUrl,
        avatarPath: r.avatarPath,
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// getAcceptedFriendIds — the actor's accepted friends, most-recent edge first
// ---------------------------------------------------------------------------
// Shared by listCircleFeed (capped, today-only ambient snapshot) and
// listFriendsThreadFeed (uncapped, paginated combined thread).

async function getAcceptedFriendIds(
  actorId: string,
  db: Db
): Promise<string[]> {
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

  return friendRows.map((r) =>
    r.userLow === actorId ? r.userHigh : r.userLow
  );
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

  // Most-recently-connected first so the cap below is deterministic.
  const friendIds = await getAcceptedFriendIds(actorId, db);

  // Cap the number of FRIENDS considered (non-scrollable ambient wall). The
  // actor is always included beyond the cap so they keep their own table even
  // with a full circle — presence without your own presence is surveillance.
  const cappedFriendIds = friendIds.slice(0, CIRCLE_FEED_FRIEND_CAP);
  const queryUserIds = [actorId, ...cappedFriendIds];

  // Most-recent shared ('circle' or 'public') meal per user within today —
  // the actor plus their (capped) friends. Self-inclusion stays userId-scoped:
  // a user only ever sees their own meal and meals of users they are accepted
  // friends with (the friendIds set is derived from accepted edges above).
  const rows = await mostRecentSharedMealsToday(
    queryUserIds,
    dayStart,
    dayEnd,
    db
  );

  const shareIds = rows.map((row) => row.shareId);
  const [reactions, replies] = await Promise.all([
    reactionsForShares(actorId, shareIds, db),
    repliesForShares(actorId, shareIds, db),
  ]);
  const entries = rows.map((row) =>
    toSharedMealEntry(
      row,
      actorId,
      reactions.get(row.shareId),
      replies.get(row.shareId)
    )
  );

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
// getFriendsFeedReadMarker — the actor's "last checked the Friends feed" time
// ---------------------------------------------------------------------------
// friends_feed_read_markers is its own table (not a column on public_profiles
// — see schema.ts's comment on why) so this stays owner-only. Lazily
// provisions the row on first read, defaulting to "now" so a first-time
// viewer never sees a backlog as unread — same idea as
// chat_group_members.last_read_at's DEFAULT now().

export async function getFriendsFeedReadMarker(
  actorId: string,
  db: Db = defaultDb
): Promise<{ lastReadAt: string }> {
  await db
    .insert(friendsFeedReadMarkers)
    .values({ userId: actorId })
    .onConflictDoNothing();

  const [row] = await db
    .select({ lastReadAt: friendsFeedReadMarkers.lastReadAt })
    .from(friendsFeedReadMarkers)
    .where(eq(friendsFeedReadMarkers.userId, actorId))
    .limit(1);

  return { lastReadAt: row.lastReadAt.toISOString() };
}

// ---------------------------------------------------------------------------
// listFriendsThreadFeed — every friend's shared-meal history, merged, paginated
// ---------------------------------------------------------------------------
// The Friends section is one combined thread (not one row per friend): every
// accepted friend's shared meal PLUS the actor's own, merged into a single
// feed (Threads-style — you see your own posts too; they render as `isSelf`,
// so no Copy/Split and they don't drive the All unread dot). Deliberately a
// separate query rather than a variant of listCircleFeed: that one must stay
// exactly "today, latest per friend, capped" for the sidebar subtitle, while
// this shows every shared meal across the whole friend graph, seek-paginated
// oldest-ward via `before`.

export async function listFriendsThreadFeed(
  actorId: string,
  input: { before?: string },
  db: Db = defaultDb
): Promise<FriendsThreadFeedPage> {
  const parsed = friendsThreadFeedSchema.parse(input);

  const before = decodeSharedMealCursor(parsed.before);

  const { rows, nextCursor } = await sharedMealsBefore(actorId, before, db);

  const shareIds = rows.map((row) => row.shareId);
  const [reactions, replies] = await Promise.all([
    reactionsForShares(actorId, shareIds, db),
    repliesForShares(actorId, shareIds, db),
  ]);
  const entries = rows.map((row) =>
    toSharedMealEntry(
      row,
      actorId,
      reactions.get(row.shareId),
      replies.get(row.shareId)
    )
  );

  // Advance only after the complete read/enrichment succeeds, and only to the
  // newest share the actor actually received — never to wall-clock time.
  const newest = rows[0];
  if (!parsed.before && newest) {
    await db
      .insert(friendsFeedReadMarkers)
      .values({ userId: actorId, lastReadAt: newest.sharedAt })
      .onConflictDoUpdate({
        target: friendsFeedReadMarkers.userId,
        set: {
          // ISO string, not the Date object — raw sql params bypass the column
          // mapper and postgres.js cannot serialize a bare Date there.
          lastReadAt: sql`GREATEST(${friendsFeedReadMarkers.lastReadAt}, ${newest.sharedAt.toISOString()}::timestamptz)`,
        },
      });
  }

  return { entries, nextCursor };
}
