import { and, eq, or } from 'drizzle-orm';
import { orderedPair } from '@/lib/domain/social/friendship';
import { db as defaultDb } from '@/lib/infra/db';
import {
  chatGroupMembers,
  chatGroups,
  friendships,
} from '@/lib/infra/db/schema';
import type { ChatGroupDb } from './membership';

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

/** Self-heal direct groups created before this invariant shipped. The common
 * case is one SELECT; only missing pairs pay the two batched INSERTs. */
export async function ensureDirectChatsForAcceptedFriends(
  actorId: string,
  db: ChatGroupDb
): Promise<string[]> {
  const friendPairs = await db
    .select({
      userLow: friendships.userLow,
      userHigh: friendships.userHigh,
      groupId: chatGroups.id,
    })
    .from(friendships)
    .leftJoin(
      chatGroups,
      and(
        eq(chatGroups.kind, 'direct'),
        eq(chatGroups.directUserLow, friendships.userLow),
        eq(chatGroups.directUserHigh, friendships.userHigh)
      )
    )
    .where(
      and(
        or(eq(friendships.userLow, actorId), eq(friendships.userHigh, actorId)),
        eq(friendships.status, 'accepted')
      )
    );

  const friendIds = friendPairs.map((pair) =>
    pair.userLow === actorId ? pair.userHigh : pair.userLow
  );
  const missingPairs = friendPairs.filter((pair) => pair.groupId === null);
  if (missingPairs.length === 0) return friendIds;

  const createdGroups = await db
    .insert(chatGroups)
    .values(
      missingPairs.map((pair) => ({
        kind: 'direct' as const,
        createdBy: actorId,
        directUserLow: pair.userLow,
        directUserHigh: pair.userHigh,
      }))
    )
    .onConflictDoNothing({
      target: [chatGroups.directUserLow, chatGroups.directUserHigh],
    })
    .returning({
      id: chatGroups.id,
      userLow: chatGroups.directUserLow,
      userHigh: chatGroups.directUserHigh,
    });

  if (createdGroups.length > 0) {
    const memberRows = createdGroups.flatMap((group) => {
      if (!group.userLow || !group.userHigh) return [];
      return [
        {
          groupId: group.id,
          userId: group.userLow,
          role: 'member' as const,
        },
        {
          groupId: group.id,
          userId: group.userHigh,
          role: 'member' as const,
        },
      ];
    });
    await db
      .insert(chatGroupMembers)
      .values(memberRows)
      .onConflictDoNothing({
        target: [chatGroupMembers.groupId, chatGroupMembers.userId],
      });
  }

  return friendIds;
}
