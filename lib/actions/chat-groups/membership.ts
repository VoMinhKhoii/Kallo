import { and, eq, inArray, or, sql } from 'drizzle-orm';
import type { AppTransaction } from '@/lib/db';
import { db as defaultDb } from '@/lib/db';
import { chatGroupMembers, chatGroups, friendships } from '@/lib/db/schema';
import { Errors } from '@/lib/errors/catalog';
import { orderedPair } from '@/lib/social/friendship';
import {
  addChatGroupMembersSchema,
  leaveChatGroupSchema,
  removeChatGroupMemberSchema,
} from '@/lib/validation/chat';

// Also accepts a transaction so invite acceptance remains atomic.
export type ChatGroupDb = typeof defaultDb | AppTransaction;

export interface GroupAccess {
  kind: 'direct' | 'group';
  role: 'owner' | 'member';
  joinedAt: Date;
  directUserLow: string | null;
  directUserHigh: string | null;
}

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

/** Resolve accepted candidates in one canonical-pair query. */
export async function acceptedFriendsAmong(
  actorId: string,
  candidateIds: string[],
  db: ChatGroupDb
): Promise<Set<string>> {
  const candidates = [...new Set(candidateIds)].filter((id) => id !== actorId);
  if (candidates.length === 0) return new Set();

  const rows = await db
    .select({
      userLow: friendships.userLow,
      userHigh: friendships.userHigh,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.userLow, actorId),
            inArray(friendships.userHigh, candidates)
          ),
          and(
            eq(friendships.userHigh, actorId),
            inArray(friendships.userLow, candidates)
          )
        )
      )
    );

  return new Set(
    rows.map((row) => (row.userLow === actorId ? row.userHigh : row.userLow))
  );
}

// For direct chats, membership alone is not enough: removing or blocking a
// friend leaves stale member rows so history can survive a later re-friend.
export async function requireGroupAccess(
  actorId: string,
  groupId: string,
  db: ChatGroupDb,
  opts?: { lock?: 'update' }
): Promise<GroupAccess> {
  const query = db
    .select({
      kind: chatGroups.kind,
      role: chatGroupMembers.role,
      joinedAt: chatGroupMembers.joinedAt,
      directUserLow: chatGroups.directUserLow,
      directUserHigh: chatGroups.directUserHigh,
      directFriendAccepted: sql<boolean>`
        ${chatGroups.kind} <> 'direct'
        OR (
          (${chatGroups.directUserLow} = ${actorId}
            OR ${chatGroups.directUserHigh} = ${actorId})
          AND EXISTS (
            SELECT 1
            FROM ${friendships}
            WHERE ${friendships.userLow} = ${chatGroups.directUserLow}
              AND ${friendships.userHigh} = ${chatGroups.directUserHigh}
              AND ${friendships.status} = 'accepted'
          )
        )
      `,
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
  const rows =
    opts?.lock === 'update'
      ? await query.for('update', { of: chatGroupMembers })
      : await query;
  const row = rows[0];
  if (!row || !row.directFriendAccepted) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }
  if (row.kind !== 'direct' && row.kind !== 'group') {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }
  return {
    kind: row.kind,
    role: row.role === 'owner' ? 'owner' : 'member',
    joinedAt: row.joinedAt,
    directUserLow: row.directUserLow,
    directUserHigh: row.directUserHigh,
  };
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
    await lockChatGroup(parsed.groupId, tx);
    const access = await requireGroupAccess(actorId, parsed.groupId, tx, {
      lock: 'update',
    });

    if (access.role === 'owner') {
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

export async function lockChatGroup(
  groupId: string,
  db: ChatGroupDb
): Promise<{ id: string; kind: string }> {
  const [group] = await db
    .select({ id: chatGroups.id, kind: chatGroups.kind })
    .from(chatGroups)
    .where(eq(chatGroups.id, groupId))
    .limit(1)
    .for('update');
  if (!group) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }
  return group;
}

/** Add the actor's accepted friends with a fresh post-join boundary. */
export async function addChatGroupMembers(
  actorId: string,
  input: { groupId: string; memberUserIds: string[] },
  db: ChatGroupDb = defaultDb
): Promise<{ added: number }> {
  const parsed = addChatGroupMembersSchema.parse(input);
  const memberIds = [...new Set(parsed.memberUserIds)].filter(
    (id) => id !== actorId
  );
  if (memberIds.length === 0) {
    throw Errors.validationFailed('Chọn ít nhất một thành viên.');
  }

  return db.transaction(async (tx) => {
    await lockChatGroup(parsed.groupId, tx);
    const access = await requireGroupAccess(actorId, parsed.groupId, tx);
    if (access.kind !== 'group') {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }

    const acceptedFriendIds = await acceptedFriendsAmong(
      actorId,
      memberIds,
      tx
    );
    if (acceptedFriendIds.size !== memberIds.length) {
      throw Errors.validationFailed(
        'Chỉ có thể thêm bạn bè đã kết nối vào nhóm.'
      );
    }

    const currentMembers = await tx
      .select({ userId: chatGroupMembers.userId })
      .from(chatGroupMembers)
      .where(eq(chatGroupMembers.groupId, parsed.groupId));
    const currentIds = new Set(currentMembers.map((member) => member.userId));
    const toInsert = memberIds.filter((id) => !currentIds.has(id));
    if (currentMembers.length + toInsert.length > 50) {
      throw Errors.validationFailed('Nhóm tối đa 50 thành viên.');
    }
    if (toInsert.length === 0) {
      return { added: 0 };
    }

    const inserted = await tx
      .insert(chatGroupMembers)
      .values(
        toInsert.map((userId) => ({
          groupId: parsed.groupId,
          userId,
          role: 'member' as const,
        }))
      )
      .onConflictDoNothing({
        target: [chatGroupMembers.groupId, chatGroupMembers.userId],
      })
      .returning({ id: chatGroupMembers.id });

    return { added: inserted.length };
  });
}

/** Owner-only: remove another member. Removing yourself is leaveChatGroup. */
export async function removeChatGroupMember(
  actorId: string,
  input: { groupId: string; memberUserId: string },
  db: ChatGroupDb = defaultDb
): Promise<{ removed: true }> {
  const parsed = removeChatGroupMemberSchema.parse(input);
  if (parsed.memberUserId === actorId) {
    throw Errors.validationFailed('Dùng "Rời nhóm" để tự rời khỏi nhóm.');
  }

  return db.transaction(async (tx) => {
    await lockChatGroup(parsed.groupId, tx);
    const access = await requireGroupAccess(actorId, parsed.groupId, tx);
    if (access.kind !== 'group') {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }
    if (access.role !== 'owner') {
      throw Errors.validationFailed('Chỉ chủ nhóm mới có thể xóa thành viên.');
    }

    const removed = await tx
      .delete(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, parsed.memberUserId)
        )
      )
      .returning({ id: chatGroupMembers.id });
    if (removed.length === 0) {
      throw Errors.notFound('Không tìm thấy thành viên.');
    }
    return { removed: true };
  });
}
