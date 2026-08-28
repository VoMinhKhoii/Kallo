/**
 * Free-tier circle quotas: how many groups you may belong to, how many
 * friends you may accept.
 *
 * The `unlimited_circle` feature covers three actor-side actions (creating a
 * group, sending a GROUP chat message, adding members) plus two per-user caps
 * — `FREE_GROUP_LIMIT` group memberships and `FREE_FRIEND_LIMIT` accepted
 * friends. Reads, reactions and replies are never gated, and 1:1 direct chats
 * stay free.
 *
 * GRANDFATHERING: every check guards a NEW insertion only. A user who is
 * already over a cap keeps everything they have; they simply cannot be added
 * to another group / gain another friend while free.
 *
 * 409 vs 402: when the exhausted quota belongs to the ACTOR, the actor is the
 * one who can fix it, so it throws `FeatureLockedError` (402) and their
 * paywall opens. When it belongs to SOMEONE ELSE (a premium owner adding a
 * free friend who is at their group cap; an accepter whose inviter is full),
 * a 402 would pop the wrong person's paywall — those throw
 * `Errors.circleLimitReached` (409) with a message naming the capped user.
 *
 * KILL-SWITCH: every entry point returns before touching the database when
 * `BILLING_ENFORCEMENT_ENABLED` is off, so an unenforced deployment issues
 * exactly the queries it issued before this module existed — including the
 * advisory locks below.
 *
 * CONCURRENCY: a count-then-insert is a race. Two adds of the same free user
 * to DIFFERENT groups (or two accepts touching DIFFERENT friendship edges)
 * touch no common row, so the callers' row locks never serialise them and
 * both can observe a count under the cap and both commit. Every capacity
 * check therefore takes a per-user transaction advisory lock on the caller's
 * transaction BEFORE counting, which holds until the caller's insert commits.
 *
 * LOCK ORDERING — a new call site must not invert this:
 *   1. the row lock it already needs (`lockChatGroup` in
 *      lib/actions/chat-groups/membership.ts; the `FOR UPDATE` on the
 *      friendship edge in lib/actions/groups/friendship.ts), THEN
 *   2. the advisory locks taken here, in ascending user-id order.
 * `createChatGroup` (lib/actions/chat-groups/create-and-list.ts) holds no row
 * lock at all and so takes only step 2. Taking an advisory lock first and a
 * row lock second in some future caller would create a lock cycle with these.
 */

import { and, eq, inArray, or, sql } from 'drizzle-orm';
import type { FeatureLockedReason } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import {
  checkFeatureAccess,
  getBillingConfig,
} from '@/lib/domain/billing/billing';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  chatGroups,
  friendships,
  publicProfiles,
  userProfiles,
} from '@/lib/infra/db/schema';

/** Groups (`kind='group'`) a free user may belong to. */
export const FREE_GROUP_LIMIT = 2;
/** Accepted friends a free user may have. */
export const FREE_FRIEND_LIMIT = 10;

const FEATURE = 'unlimited_circle' as const;

/** Accepts a transaction so quota reads join the caller's atomic unit. */
export type CircleQuotaDb = AppDb | AppTransaction;

interface ProfileMeta {
  userId: string;
  name: string;
  profileCreatedAt: Date;
}

function enforcementOff(): boolean {
  return !getBillingConfig().enforcementEnabled;
}

// Entitlement reads run on the CALLER's handle (`EntitlementDeps.db`): inside
// an open transaction a second pool connection can starve `DB_POOL_MAX=2`.
function entitlementDeps(db: CircleQuotaDb) {
  return { db: db as AppDb };
}

/**
 * Serialise the count-then-insert for each affected user.
 *
 * `pg_advisory_xact_lock` is taken on the CALLER's handle so it lives in the
 * caller's transaction (a second pool connection would starve `DB_POOL_MAX=2`)
 * and releases on commit/rollback with no unlock bookkeeping.
 *
 * The two-argument (classid, objid) form namespaces the lock under
 * `hashtext('circle_quota')`, so a hash collision with another advisory-lock
 * user costs at most extra serialisation, never a missed lock. Locks are taken
 * one statement at a time in ascending id order: a set-returning
 * `pg_advisory_xact_lock(...) FROM unnest(...)` has no guaranteed evaluation
 * order and could deadlock two overlapping batches against each other.
 */
async function lockUserQuotas(
  db: CircleQuotaDb,
  userIds: string[]
): Promise<void> {
  for (const userId of [...new Set(userIds)].sort()) {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext('circle_quota'), hashtext(${userId}::text))`
    );
  }
}

async function isAllowed(
  db: CircleQuotaDb,
  profile: ProfileMeta
): Promise<
  { allowed: true } | { allowed: false; reason: FeatureLockedReason }
> {
  const access = await checkFeatureAccess(
    { userId: profile.userId, profileCreatedAt: profile.profileCreatedAt },
    FEATURE,
    entitlementDeps(db)
  );
  if (access.allowed) return { allowed: true };
  return {
    allowed: false,
    reason:
      access.reason === 'trial_expired' ? 'trial_expired' : 'not_entitled',
  };
}

/** Display names live on `public_profiles`; the trial clock on `user_profiles`. */
async function loadProfiles(
  db: CircleQuotaDb,
  userIds: string[]
): Promise<Map<string, ProfileMeta>> {
  const rows = await db
    .select({
      userId: publicProfiles.userId,
      displayName: publicProfiles.displayName,
      handle: publicProfiles.handle,
      publicCreatedAt: publicProfiles.createdAt,
      profileCreatedAt: userProfiles.createdAt,
    })
    .from(publicProfiles)
    .leftJoin(userProfiles, eq(userProfiles.userId, publicProfiles.userId))
    .where(inArray(publicProfiles.userId, userIds));

  return new Map(
    rows.map((row) => [
      row.userId,
      {
        userId: row.userId,
        name: row.displayName?.trim() || row.handle,
        profileCreatedAt: row.profileCreatedAt ?? row.publicCreatedAt,
      },
    ])
  );
}

/**
 * The actor must hold `unlimited_circle` at all: free users cannot create
 * groups, add members, or send group chat messages. Chat actions authenticate
 * with `requireUserId()` alone, so the trial clock is read here.
 */
export async function assertUnlimitedCircleActor(
  db: CircleQuotaDb,
  actorId: string
): Promise<void> {
  if (enforcementOff()) return;

  const rows = await db
    .select({ profileCreatedAt: userProfiles.createdAt })
    .from(userProfiles)
    .where(eq(userProfiles.userId, actorId))
    .limit(1);
  const profileCreatedAt = rows[0]?.profileCreatedAt;
  if (!profileCreatedAt) throw Errors.profileNotFound();

  const access = await isAllowed(db, {
    userId: actorId,
    name: '',
    profileCreatedAt,
  });
  if (!access.allowed) throw Errors.featureLocked(FEATURE, access.reason);
}

/**
 * Each ADDED user must have room for one more group. The actor may well be
 * premium while a member they add is capped, so denials here are 409s naming
 * the member — never the actor's paywall.
 */
export async function assertGroupCapacity(
  db: CircleQuotaDb,
  addedUserIds: string[]
): Promise<void> {
  if (enforcementOff()) return;

  const userIds = [...new Set(addedUserIds)];
  if (userIds.length === 0) return;

  await lockUserQuotas(db, userIds);

  const counts = await db
    .select({
      userId: chatGroupMembers.userId,
      groupCount: sql<number>`count(*)::int`,
    })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMembers.groupId))
    .where(
      and(
        eq(chatGroups.kind, 'group'),
        inArray(chatGroupMembers.userId, userIds)
      )
    )
    .groupBy(chatGroupMembers.userId);

  const atCap = counts
    .filter((row) => Number(row.groupCount) >= FREE_GROUP_LIMIT)
    .map((row) => row.userId);
  if (atCap.length === 0) return;

  const profiles = await loadProfiles(db, atCap);
  for (const userId of atCap) {
    const profile = profiles.get(userId);
    // No profile row → nothing to evaluate the trial against; fail open
    // rather than block a group on missing identity data.
    if (!profile) continue;
    const access = await isAllowed(db, profile);
    if (access.allowed) continue;
    throw Errors.circleLimitReached(
      `${profile.name} đã đạt giới hạn ${FREE_GROUP_LIMIT} nhóm của gói miễn phí.`
    );
  }
}

export interface FriendCapacityInput {
  accepterId: string;
  inviterId: string;
  inviterName: string;
}

/**
 * Both sides of a new accepted edge must have room. The accepter is checked
 * first — their denial is the actionable one (402, their own paywall) — then
 * the inviter, whose cap surfaces as a 409 naming them.
 */
export async function assertFriendCapacity(
  db: CircleQuotaDb,
  { accepterId, inviterId, inviterName }: FriendCapacityInput
): Promise<void> {
  if (enforcementOff()) return;

  await lockUserQuotas(db, [accepterId, inviterId]);

  const [counts] = await db
    .select({
      accepterCount: sql<number>`(count(*) filter (where ${friendships.userLow} = ${accepterId} or ${friendships.userHigh} = ${accepterId}))::int`,
      inviterCount: sql<number>`(count(*) filter (where ${friendships.userLow} = ${inviterId} or ${friendships.userHigh} = ${inviterId}))::int`,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          eq(friendships.userLow, accepterId),
          eq(friendships.userHigh, accepterId),
          eq(friendships.userLow, inviterId),
          eq(friendships.userHigh, inviterId)
        )
      )
    );

  const accepterFull = Number(counts?.accepterCount ?? 0) >= FREE_FRIEND_LIMIT;
  const inviterFull = Number(counts?.inviterCount ?? 0) >= FREE_FRIEND_LIMIT;
  if (!(accepterFull || inviterFull)) return;

  const ids = [
    ...(accepterFull ? [accepterId] : []),
    ...(inviterFull ? [inviterId] : []),
  ];
  const profiles = await loadProfiles(db, ids);

  if (accepterFull) {
    const profile = profiles.get(accepterId);
    if (profile) {
      const access = await isAllowed(db, profile);
      if (!access.allowed) throw Errors.featureLocked(FEATURE, access.reason);
    }
  }

  if (inviterFull) {
    const profile = profiles.get(inviterId);
    if (profile) {
      const access = await isAllowed(db, profile);
      if (!access.allowed) {
        const name = profile.name || inviterName;
        throw Errors.circleLimitReached(
          `${name} đã đạt giới hạn ${FREE_FRIEND_LIMIT} bạn bè của gói miễn phí.`
        );
      }
    }
  }
}
