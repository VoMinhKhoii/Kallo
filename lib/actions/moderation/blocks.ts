// Block / unblock / list-blocked service functions. SECURITY: the Drizzle db
// handle bypasses RLS — every query carries the actor from the session.
//
// A block is one DIRECTED user_blocks row (blocker → blocked). Each person
// holds their own: A blocking B and B blocking A are two rows, and lifting one
// leaves the other in force. Reads apply the rule symmetrically — any row in
// either direction hides both people from each other everywhere
// (lib/domain/social/moderation/blocks.ts).
//
// Blocking also ENDS the friendship: the pair's friendships row is deleted in
// the same transaction, so direct chat, the friends feed and the friend list
// close by construction. Unblocking never restores it — the pair are strangers
// again and must re-invite to reconnect.

import { and, desc, eq } from 'drizzle-orm';
import { unblockUserBodySchema } from '@/lib/api/contracts/social/moderation';
import { Errors } from '@/lib/core/errors/catalog';
import { blockFriendSchema } from '@/lib/core/validation/social';
import { orderedPair } from '@/lib/domain/social/friendship';
import {
  type PublicIdentity,
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/domain/social/identity/public-identity';
import { lockPairSql } from '@/lib/domain/social/moderation/blocks';
import { type AppDb, db as defaultDb } from '@/lib/infra/db/client';
import { friendships, publicProfiles, userBlocks } from '@/lib/infra/db/schema';

export interface BlockedUser {
  profile: PublicIdentity;
  /** When the block was placed. */
  blockedAt: string;
}

/**
 * Block `targetUserId`: record the actor's block and end any friendship, in
 * one transaction under the pair lock that acceptInvite also takes — so an
 * invite accepted concurrently can never re-create the friendship after the
 * block. Idempotent: blocking twice keeps the first row and its time.
 */
export async function blockFriend(
  actorId: string,
  input: { targetUserId: string },
  db: AppDb = defaultDb
): Promise<{ status: 'blocked' }> {
  const { targetUserId } = blockFriendSchema.parse(input);
  if (targetUserId === actorId) {
    throw Errors.validationFailed('Không thể chặn chính mình.');
  }
  const { userLow, userHigh } = orderedPair(actorId, targetUserId);

  return db.transaction(async (tx) => {
    await tx.execute(lockPairSql(userLow, userHigh));
    await tx
      .insert(userBlocks)
      .values({ blockerId: actorId, blockedId: targetUserId })
      .onConflictDoNothing({
        target: [userBlocks.blockerId, userBlocks.blockedId],
      });
    await tx
      .delete(friendships)
      .where(
        and(
          eq(friendships.userLow, userLow),
          eq(friendships.userHigh, userHigh)
        )
      );
    return { status: 'blocked' as const };
  });
}

/**
 * Lift the actor's OWN block on `targetUserId`. Deletes only the actor's row:
 * if the other person also blocked the actor, that block stays in force. A
 * caller with no block of their own on this person — including the one who
 * was blocked — gets the same 404 as "no such block", so the endpoint cannot
 * be used to learn that someone blocked you.
 */
export async function unblockFriend(
  actorId: string,
  input: { targetUserId: string },
  db: AppDb = defaultDb
): Promise<{ unblocked: true }> {
  const { targetUserId } = unblockUserBodySchema.parse(input);
  if (targetUserId === actorId) {
    throw Errors.validationFailed('Không thể bỏ chặn chính mình.');
  }

  const deleted = await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, actorId),
        eq(userBlocks.blockedId, targetUserId)
      )
    )
    .returning({ blockedId: userBlocks.blockedId });

  if (deleted.length === 0) {
    throw Errors.notFound('Không tìm thấy người bị chặn.');
  }
  return { unblocked: true };
}

/**
 * The people the actor has blocked, newest first — the actor's own rows only.
 * Someone who blocked the actor is never listed (that would reveal the block
 * to the blocked side).
 */
export async function listBlockedUsers(
  actorId: string,
  db: AppDb = defaultDb
): Promise<BlockedUser[]> {
  const rows = await db
    .select({
      userId: publicProfiles.userId,
      ...publicProfileColumns,
      blockedAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .innerJoin(publicProfiles, eq(publicProfiles.userId, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, actorId))
    .orderBy(desc(userBlocks.createdAt));

  return rows.map(({ blockedAt, ...profile }) => ({
    profile: toPublicIdentity(profile),
    blockedAt: blockedAt.toISOString(),
  }));
}
