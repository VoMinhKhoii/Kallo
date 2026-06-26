// ---------------------------------------------------------------------------
// Group tracking — profile / friendship / feed service functions
// ---------------------------------------------------------------------------
// Pure, dependency-light async functions. Each takes the authenticated actor's
// id plus an optional Drizzle `db` handle (defaulting to the app singleton) so
// the REST routes and tests can call them directly. NOTE: this Drizzle `db`
// connects via DATABASE_URL as the owner role and BYPASSES RLS, so the
// app-layer `WHERE actor = ...` scoping below is the PRIMARY authorization
// control here, not defense-in-depth — every query must carry an explicit actor
// predicate. RLS is the source of truth only for the Supabase-session/PostgREST
// path (direct client reads + the OG card route).

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
import { generateInviteSlug } from '@/lib/groups/slug';
import {
  acceptInviteSchema,
  blockFriendSchema,
  circleFeedSchema,
  handleSchema,
  removeFriendSchema,
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
  /** True when this entry is the actor's own shared meal (their own table). */
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

  // Seed the warm-palette avatar/swatch from the handle when the caller does
  // not supply one, so every claimed profile renders a stable, distinct color.
  const avatarSeed = parsed.avatarSeed ?? handle;

  try {
    const [row] = await db
      .insert(publicProfiles)
      .values({
        userId: actorId,
        handle,
        displayName: parsed.displayName ?? null,
        avatarSeed,
      })
      .onConflictDoUpdate({
        target: publicProfiles.userId,
        set: {
          handle,
          displayName: parsed.displayName ?? null,
          avatarSeed,
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
  } catch (error) {
    // The handle unique index is the ultimate guard: a concurrent claim of the
    // same handle by a different user (which the pre-check above can race past)
    // surfaces as a Postgres 23505 unique violation. Map it to a clean 409
    // instead of leaking a raw 500.
    if ((error as { code?: string } | null)?.code === '23505') {
      throw Errors.conflict('Handle này đã được sử dụng.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// getMyPublicProfile — the actor's own profile (or null if not claimed yet)
// ---------------------------------------------------------------------------

export async function getMyPublicProfile(
  actorId: string,
  db: Db = defaultDb
): Promise<PublicProfile | null> {
  const rows = await db
    .select({
      userId: publicProfiles.userId,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, actorId))
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// getOrCreateMyProfile — auto-provision a link profile on first use
// ---------------------------------------------------------------------------
// No "claim a username" gate: the user gets a shareable link immediately, with
// a generated slug they can edit later (upsertPublicProfile). The slug is the
// editable end of the invite link and doubles as the person's circle label.

export async function getOrCreateMyProfile(
  actorId: string,
  db: Db = defaultDb
): Promise<PublicProfile> {
  const existing = await getMyPublicProfile(actorId, db);
  if (existing) return existing;

  // Provision with a generated slug; retry a few times on a uniqueness clash.
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = generateInviteSlug();
    try {
      const [row] = await db
        .insert(publicProfiles)
        .values({
          userId: actorId,
          handle,
          displayName: null,
          avatarSeed: handle,
        })
        .returning();
      return {
        userId: row.userId,
        handle: row.handle,
        displayName: row.displayName,
        avatarSeed: row.avatarSeed,
      };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === '23505') {
        // Either a concurrent provision for this user, or a slug clash.
        const now = await getMyPublicProfile(actorId, db);
        if (now) return now;
        continue; // slug collision — retry with a fresh slug
      }
      throw error;
    }
  }
  throw Errors.conflict('Không thể tạo liên kết mời. Vui lòng thử lại.');
}

// ---------------------------------------------------------------------------
// getProfileBySlug — resolve an inviter from their link slug (exact match)
// ---------------------------------------------------------------------------
// Server-only: the public invite page calls this via the owner-role Drizzle db
// (which bypasses RLS). Exact match only — no search/prefix surface, so it is
// not enumerable.

export async function getProfileBySlug(
  slug: string,
  db: Db = defaultDb
): Promise<PublicProfile | null> {
  const parsed = handleSchema.safeParse(slug);
  if (!parsed.success) return null;

  const rows = await db
    .select({
      userId: publicProfiles.userId,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.handle, parsed.data))
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// acceptInvite — the recipient taps Accept on a link; connect directly
// ---------------------------------------------------------------------------
// The recipient's tap IS the accept (Locket model): no separate inviter
// approval. Creates an accepted edge, or promotes a pre-existing pending one.
// The friendship write + event are transactional so an event can't be orphaned.

export async function acceptInvite(
  actorId: string,
  input: { slug: string },
  db: Db = defaultDb
): Promise<{ status: 'accepted'; inviter: PublicProfile }> {
  const parsed = acceptInviteSchema.parse(input);

  const inviter = await getProfileBySlug(parsed.slug, db);
  if (!inviter) {
    throw Errors.notFound('Liên kết mời không hợp lệ.');
  }
  if (inviter.userId === actorId) {
    throw Errors.validationFailed('Không thể kết nối với chính mình.');
  }

  // Provision the recipient's own link profile so they carry a circle label in
  // the inviter's circle even if they accept before ever opening their own
  // Groups page. Idempotent — returns the existing profile when one exists.
  await getOrCreateMyProfile(actorId, db);

  const { userLow, userHigh } = orderedPair(actorId, inviter.userId);

  return db.transaction(async (tx) => {
    // Lock the canonical edge row for the duration of the transaction so a
    // concurrent blockFriend/acceptInvite can't interleave between this read
    // and the promote below (which would let an accept land on top of a block).
    const existing = await tx
      .select({ id: friendships.id, status: friendships.status })
      .from(friendships)
      .where(
        and(
          eq(friendships.userLow, userLow),
          eq(friendships.userHigh, userHigh)
        )
      )
      .limit(1)
      .for('update');

    if (existing[0]) {
      if (existing[0].status === 'blocked') {
        throw Errors.conflict('Không thể kết nối.');
      }
      if (existing[0].status === 'accepted') {
        return { status: 'accepted' as const, inviter };
      }
      // Promote a pending edge (either direction) to accepted. The row is
      // locked above; the status guard is defence-in-depth.
      await tx
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(
          and(
            eq(friendships.id, existing[0].id),
            sql`${friendships.status} <> 'blocked'`
          )
        );
      await tx.insert(circleEvents).values({
        actorId,
        type: 'friend_accepted',
        refId: existing[0].id,
      });
      return { status: 'accepted' as const, inviter };
    }

    // No edge yet. The locked read can't lock a row that doesn't exist, so a
    // racing accept/block may insert first; swallow the unique violation and
    // reconcile instead of surfacing a spurious 500 on this core action.
    const inserted = await tx
      .insert(friendships)
      .values({
        userLow,
        userHigh,
        // The inviter initiated by sharing the link; the recipient accepted.
        requestedBy: inviter.userId,
        status: 'accepted',
      })
      .onConflictDoNothing({
        target: [friendships.userLow, friendships.userHigh],
      })
      .returning({ id: friendships.id });

    if (inserted[0]) {
      await tx.insert(circleEvents).values({
        actorId,
        type: 'friend_accepted',
        refId: inserted[0].id,
      });
      return { status: 'accepted' as const, inviter };
    }

    // A concurrent writer won the insert — re-read and honour a block.
    const reconciled = await tx
      .select({ status: friendships.status })
      .from(friendships)
      .where(
        and(
          eq(friendships.userLow, userLow),
          eq(friendships.userHigh, userHigh)
        )
      )
      .limit(1);
    if (reconciled[0]?.status === 'blocked') {
      throw Errors.conflict('Không thể kết nối.');
    }
    return { status: 'accepted' as const, inviter };
  });
}

// ---------------------------------------------------------------------------
// removeFriend — drop a connection (re-invitable later)
// ---------------------------------------------------------------------------
// Deletes the canonical edge so the pair can reconnect via a new invite. Never
// clears a 'blocked' edge (removing a friend must not silently unblock).

export async function removeFriend(
  actorId: string,
  input: { targetUserId: string },
  db: Db = defaultDb
): Promise<{ removed: boolean }> {
  const parsed = removeFriendSchema.parse(input);
  if (parsed.targetUserId === actorId) {
    throw Errors.validationFailed('Không thể xoá chính mình.');
  }

  const { userLow, userHigh } = orderedPair(actorId, parsed.targetUserId);

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.userLow, userLow),
        eq(friendships.userHigh, userHigh),
        sql`${friendships.status} <> 'blocked'`
      )
    );

  return { removed: true };
}

// ---------------------------------------------------------------------------
// getFriendshipStatus — the actor's edge status with another user, or null
// ---------------------------------------------------------------------------

export async function getFriendshipStatus(
  actorId: string,
  otherUserId: string,
  db: Db = defaultDb
): Promise<string | null> {
  const { userLow, userHigh } = orderedPair(actorId, otherUserId);
  const rows = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh))
    )
    .limit(1);
  return rows[0]?.status ?? null;
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
