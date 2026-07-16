// Friendship service functions. SECURITY: the Drizzle db handle bypasses RLS —
// every query must carry an explicit actor predicate (see ./types.ts).

import { and, eq, sql } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { circleEvents, friendships } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { orderedPair } from '@/lib/groups/friendship';
import {
  acceptInviteSchema,
  blockFriendSchema,
  removeFriendSchema,
} from '@/lib/validation';

import { getOrCreateMyProfile, getProfileBySlug } from './profile';
import type { Db, PublicProfile } from './types';

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
