// Block / unblock / list-blocked service functions. SECURITY: the Drizzle db
// handle bypasses RLS — every query must carry an explicit actor predicate
// (see ./types.ts).
//
// A block is the pair's one canonical `friendships` row set to 'blocked', with
// `blocked_by` recording who placed it. It hides both people from each other
// everywhere (see lib/domain/social/moderation/blocks.ts for the read side).
// Only the blocker can lift it; lifting deletes the edge, so the pair are
// strangers again and must re-invite to reconnect.

import { and, desc, eq, or, sql } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import { blockFriendSchema } from '@/lib/core/validation/social';
import { orderedPair } from '@/lib/domain/social/friendship';
import {
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/domain/social/identity/public-identity';
import { db as defaultDb } from '@/lib/infra/db/client';
import { friendships, publicProfiles } from '@/lib/infra/db/schema';
import type { Db, PublicProfile } from './types';

export interface BlockedUser {
  profile: PublicProfile;
  /** When the block was placed (the edge's last status change). */
  blockedAt: string;
}

// ---------------------------------------------------------------------------
// blockFriend
// ---------------------------------------------------------------------------
// Upserts the pair's edge to 'blocked', whatever it was (none, pending,
// accepted). `blocked_by` is claimed by the FIRST blocker: if the other person
// already blocked this pair, this call changes nothing — they keep the only
// key, so being blocked can never be turned into taking over (and then
// lifting) someone else's block. A pre-`blocked_by` block (NULL) is claimed by
// whoever blocks next.

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
      blockedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [friendships.userLow, friendships.userHigh],
      set: {
        status: 'blocked',
        blockedBy: sql`CASE
          WHEN ${friendships.status} = 'blocked'
            AND ${friendships.blockedBy} IS NOT NULL
          THEN ${friendships.blockedBy}
          ELSE ${actorId}::uuid
        END`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: friendships.id, status: friendships.status });

  return { friendshipId: row.id, status: row.status };
}

// ---------------------------------------------------------------------------
// unblockFriend — only the person who placed the block may lift it
// ---------------------------------------------------------------------------
// Deletes the edge. A caller who is not the blocker (including the blocked
// person) gets the same 404 as "no such block", so the endpoint cannot be used
// to learn that someone has blocked you.

export async function unblockFriend(
  actorId: string,
  input: { targetUserId: string },
  db: Db = defaultDb
): Promise<{ unblocked: true }> {
  const parsed = blockFriendSchema.parse(input);
  if (parsed.targetUserId === actorId) {
    throw Errors.validationFailed('Không thể bỏ chặn chính mình.');
  }

  const { userLow, userHigh } = orderedPair(actorId, parsed.targetUserId);

  const deleted = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.userLow, userLow),
        eq(friendships.userHigh, userHigh),
        eq(friendships.status, 'blocked'),
        eq(friendships.blockedBy, actorId)
      )
    )
    .returning({ id: friendships.id });

  if (deleted.length === 0) {
    throw Errors.notFound('Không tìm thấy người bị chặn.');
  }
  return { unblocked: true };
}

// ---------------------------------------------------------------------------
// listBlockedUsers — the people the actor has blocked, newest first
// ---------------------------------------------------------------------------
// Only blocks the actor placed: someone who blocked the actor is never listed
// (that would reveal the block to the blocked side).

export async function listBlockedUsers(
  actorId: string,
  db: Db = defaultDb
): Promise<BlockedUser[]> {
  const rows = await db
    .select({
      userId: publicProfiles.userId,
      ...publicProfileColumns,
      blockedAt: friendships.updatedAt,
    })
    .from(friendships)
    .innerJoin(
      publicProfiles,
      or(
        and(
          eq(friendships.userLow, actorId),
          eq(publicProfiles.userId, friendships.userHigh)
        ),
        and(
          eq(friendships.userHigh, actorId),
          eq(publicProfiles.userId, friendships.userLow)
        )
      )
    )
    .where(
      and(eq(friendships.status, 'blocked'), eq(friendships.blockedBy, actorId))
    )
    .orderBy(desc(friendships.updatedAt));

  return rows.map(({ blockedAt, ...profile }) => ({
    profile: toPublicIdentity(profile),
    blockedAt: blockedAt.toISOString(),
  }));
}
