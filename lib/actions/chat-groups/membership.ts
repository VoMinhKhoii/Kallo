import { and, eq, or, sql } from 'drizzle-orm';
import type { AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import { chatGroupMembers, chatGroups, friendships } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { orderedPair } from '@/lib/groups/friendship';
import { leaveChatGroupSchema } from '@/lib/validation';

// Accepts the app db singleton OR a transaction handle, so acceptInvite can
// pass its transaction through and keep friendship + chat creation atomic.
export type ChatGroupDb = typeof defaultDb | AppTransaction;

export async function isAcceptedFriend(
  actorId: string,
  targetUserId: string,
  db: ChatGroupDb
): Promise<boolean> {
  const { userLow, userHigh } = orderedPair(actorId, targetUserId);
  const rows = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(eq(friendships.userLow, userLow), eq(friendships.userHigh, userHigh))
    )
    .limit(1);
  return rows[0]?.status === 'accepted';
}

// For direct chats, membership alone is not enough: removing or blocking a
// friend leaves stale member rows so history can survive a later re-friend.
export async function requireMembership(
  actorId: string,
  groupId: string,
  db: ChatGroupDb
): Promise<void> {
  const rows = await db
    .select({
      id: chatGroupMembers.id,
      kind: chatGroups.kind,
      directUserLow: chatGroups.directUserLow,
      directUserHigh: chatGroups.directUserHigh,
    })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMembers.groupId))
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, actorId)
      )
    )
    .limit(1);
  if (!rows[0]) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }
  const row = rows[0];
  if (row.kind === 'direct' && row.directUserLow && row.directUserHigh) {
    const otherUserId =
      row.directUserLow === actorId ? row.directUserHigh : row.directUserLow;
    const stillFriends = await isAcceptedFriend(actorId, otherUserId, db);
    if (!stillFriends) {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }
  }
}

export async function getOrCreateDirectChatGroup(
  userA: string,
  userB: string,
  db: ChatGroupDb = defaultDb
): Promise<{ id: string }> {
  const { userLow, userHigh } = orderedPair(userA, userB);

  await db
    .insert(chatGroups)
    .values({
      kind: 'direct',
      createdBy: userA,
      directUserLow: userLow,
      directUserHigh: userHigh,
    })
    .onConflictDoNothing({
      target: [chatGroups.directUserLow, chatGroups.directUserHigh],
    });

  const [group] = await db
    .select({ id: chatGroups.id })
    .from(chatGroups)
    .where(
      and(
        eq(chatGroups.directUserLow, userLow),
        eq(chatGroups.directUserHigh, userHigh)
      )
    )
    .limit(1);

  await db
    .insert(chatGroupMembers)
    .values([
      { groupId: group.id, userId: userLow, role: 'member' },
      { groupId: group.id, userId: userHigh, role: 'member' },
    ])
    .onConflictDoNothing({
      target: [chatGroupMembers.groupId, chatGroupMembers.userId],
    });

  return { id: group.id };
}

// Self-heals accepted friendships created before direct chats shipped, and
// returns the live friend ids used to hide stale direct memberships.
export async function ensureDirectChatsForAcceptedFriends(
  actorId: string,
  db: ChatGroupDb
): Promise<string[]> {
  const friendRows = await db
    .select({ userLow: friendships.userLow, userHigh: friendships.userHigh })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.userLow, actorId), eq(friendships.userHigh, actorId)),
        eq(friendships.status, 'accepted')
      )
    );

  const friendIds = friendRows.map((row) =>
    row.userLow === actorId ? row.userHigh : row.userLow
  );
  if (friendIds.length === 0) return [];

  await Promise.all(
    friendIds.map((friendId) =>
      getOrCreateDirectChatGroup(actorId, friendId, db)
    )
  );
  return friendIds;
}

/**
 * Remove only the actor's membership. A named-group owner must first become
 * the final member (or transfer/remove members in a future management flow),
 * preventing a live group from being left without an owner.
 */
export async function leaveChatGroup(
  actorId: string,
  groupId: string,
  db: ChatGroupDb = defaultDb
): Promise<{ left: true }> {
  const parsed = leaveChatGroupSchema.parse({ groupId });

  return db.transaction(async (tx) => {
    await requireMembership(actorId, parsed.groupId, tx);

    const [membership] = await tx
      .select({ role: chatGroupMembers.role })
      .from(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      )
      .limit(1)
      .for('update');
    if (!membership) {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }

    if (membership.role === 'owner') {
      const otherMembers = await tx
        .select({ id: chatGroupMembers.id })
        .from(chatGroupMembers)
        .where(
          and(
            eq(chatGroupMembers.groupId, parsed.groupId),
            sql`${chatGroupMembers.userId} <> ${actorId}`
          )
        )
        .limit(1);
      if (otherMembers[0]) {
        throw Errors.validationFailed(
          'Chủ nhóm không thể rời khi nhóm vẫn còn thành viên.'
        );
      }
    }

    await tx
      .delete(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      );
    return { left: true };
  });
}
