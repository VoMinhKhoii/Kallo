import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import { createChatGroupSchema } from '@/lib/core/validation/chat';
import { circleFeedSchema } from '@/lib/core/validation/social';
import { todayLocalDate } from '@/lib/domain/social/feed/meal-feed';
import {
  assertGroupCapacity,
  assertUnlimitedCircleActor,
} from '@/lib/domain/social/quota/circle-quota';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';
import { ensureDirectChatsForAcceptedFriends } from './direct-chats';
import { acceptedFriendsAmong, type ChatGroupDb } from './membership';
import type { ChatGroupIdentity } from './types';

export async function createChatGroup(
  actorId: string,
  input: { name: string; memberUserIds: string[] },
  db: ChatGroupDb = defaultDb
): Promise<{ id: string }> {
  const parsed = createChatGroupSchema.parse(input);

  const memberIds = [...new Set(parsed.memberUserIds)].filter(
    (id) => id !== actorId
  );
  if (memberIds.length === 0) {
    throw Errors.validationFailed('Chọn ít nhất một thành viên.');
  }

  const acceptedFriendIds = await acceptedFriendsAmong(actorId, memberIds, db);
  if (acceptedFriendIds.size !== memberIds.length) {
    throw Errors.validationFailed(
      'Chỉ có thể thêm bạn bè đã kết nối vào nhóm.'
    );
  }

  // Creating a group is premium; each member added must also have room for
  // another group (their cap, their 409 — see circle-quota).
  await assertUnlimitedCircleActor(db, actorId);

  return db.transaction(async (tx) => {
    await assertGroupCapacity(tx, memberIds);

    const [group] = await tx
      .insert(chatGroups)
      .values({ kind: 'group', name: parsed.name, createdBy: actorId })
      .returning({ id: chatGroups.id });

    await tx.insert(chatGroupMembers).values([
      { groupId: group.id, userId: actorId, role: 'owner' },
      ...memberIds.map((userId) => ({
        groupId: group.id,
        userId,
        role: 'member' as const,
      })),
    ]);

    return { id: group.id };
  });
}

export async function listMyChatGroups(
  actorId: string,
  input: { timezoneOffset: number },
  db: ChatGroupDb = defaultDb
): Promise<ChatGroupIdentity[]> {
  const viewerMembership = alias(
    chatGroupMembers,
    'activity_viewer_membership'
  );
  const unreadMessage = alias(chatGroupMessages, 'unread_group_message');
  const unreadOwnerMembership = alias(
    chatGroupMembers,
    'unread_meal_owner_membership'
  );
  const unreadShare = alias(mealShares, 'unread_group_meal_share');
  const { timezoneOffset } = circleFeedSchema.parse(input);
  const acceptedFriendIds = new Set(
    await ensureDirectChatsForAcceptedFriends(actorId, db)
  );

  const allGroups = await db
    .select({
      id: chatGroups.id,
      kind: chatGroups.kind,
      name: chatGroups.name,
      avatarSeed: chatGroups.avatarSeed,
      updatedAt: chatGroups.updatedAt,
      directUserLow: chatGroups.directUserLow,
      directUserHigh: chatGroups.directUserHigh,
      unread: sql<boolean>`
        EXISTS (
          SELECT 1
          FROM "chat_group_messages" AS "unread_group_message"
          WHERE ${unreadMessage.groupId} = ${chatGroups.id}
            AND ${unreadMessage.createdAt} > ${chatGroupMembers.lastReadAt}
        )
        OR EXISTS (
          SELECT 1
          FROM "chat_group_members" AS "unread_meal_owner_membership"
          INNER JOIN "meal_shares" AS "unread_group_meal_share"
            ON ${unreadShare.actorId} = ${unreadOwnerMembership.userId}
          WHERE ${unreadOwnerMembership.groupId} = ${chatGroups.id}
            AND ${unreadShare.visibility} <> 'private'
            AND ${unreadShare.sharedAt} > ${chatGroupMembers.lastReadAt}
            AND ${unreadShare.sharedAt} >= ${chatGroupMembers.joinedAt}
            AND ${unreadShare.sharedAt} >= ${unreadOwnerMembership.joinedAt}
        )
      `,
    })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMembers.groupId))
    .where(eq(chatGroupMembers.userId, actorId))
    .orderBy(desc(chatGroups.updatedAt));

  const myGroups = allGroups.filter((group) => {
    if (group.kind !== 'direct') return true;
    const other =
      group.directUserLow === actorId
        ? group.directUserHigh
        : group.directUserLow;
    return other != null && acceptedFriendIds.has(other);
  });

  const groupIds = myGroups.map((group) => group.id);
  const directGroupIds = myGroups
    .filter((group) => group.kind === 'direct')
    .map((group) => group.id);

  const today = todayLocalDate(timezoneOffset);
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    today,
    timezoneOffset
  );

  const [otherMembers, lastMessages, lastMealShares] = await Promise.all([
    directGroupIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            groupId: chatGroupMembers.groupId,
            handle: publicProfiles.handle,
            displayName: publicProfiles.displayName,
            avatarSeed: publicProfiles.avatarSeed,
          })
          .from(chatGroupMembers)
          .innerJoin(
            publicProfiles,
            eq(publicProfiles.userId, chatGroupMembers.userId)
          )
          .where(
            and(
              inArray(chatGroupMembers.groupId, directGroupIds),
              sql`${chatGroupMembers.userId} <> ${actorId}`
            )
          ),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .selectDistinctOn([chatGroupMessages.groupId], {
            groupId: chatGroupMessages.groupId,
            body: chatGroupMessages.body,
            createdAt: chatGroupMessages.createdAt,
          })
          .from(chatGroupMessages)
          .where(inArray(chatGroupMessages.groupId, groupIds))
          .orderBy(
            chatGroupMessages.groupId,
            desc(chatGroupMessages.createdAt),
            desc(chatGroupMessages.id)
          ),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            groupId: chatGroupMembers.groupId,
            lastSharedAt: sql<Date>`max(${mealShares.sharedAt})`,
          })
          .from(chatGroupMembers)
          .innerJoin(
            viewerMembership,
            and(
              eq(viewerMembership.groupId, chatGroupMembers.groupId),
              eq(viewerMembership.userId, actorId)
            )
          )
          .innerJoin(
            mealShares,
            eq(mealShares.actorId, chatGroupMembers.userId)
          )
          .innerJoin(
            meals,
            and(
              eq(meals.id, mealShares.mealId),
              eq(meals.userId, mealShares.actorId)
            )
          )
          .where(
            and(
              inArray(chatGroupMembers.groupId, groupIds),
              sql`${mealShares.visibility} <> 'private'`,
              gte(mealShares.sharedAt, viewerMembership.joinedAt),
              gte(mealShares.sharedAt, chatGroupMembers.joinedAt),
              gte(mealShares.sharedAt, dayStart),
              lt(mealShares.sharedAt, dayEnd)
            )
          )
          .groupBy(chatGroupMembers.groupId),
  ]);

  const otherByGroupId = new Map(otherMembers.map((row) => [row.groupId, row]));
  const lastMessageByGroupId = new Map(
    lastMessages.map((row) => [row.groupId, row])
  );
  const lastMealSharedAtByGroupId = new Map(
    lastMealShares.map((row) => [row.groupId, new Date(row.lastSharedAt)])
  );

  const identities = myGroups.map((group) => {
    const lastMessage = lastMessageByGroupId.get(group.id) ?? null;
    const lastMealSharedAt = lastMealSharedAtByGroupId.get(group.id) ?? null;
    const shared = {
      avatarSeed: group.avatarSeed,
      updatedAt: group.updatedAt.toISOString(),
      lastMessagePreview: lastMessage?.body ?? null,
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      unread: group.unread,
      lastMealSharedAt: lastMealSharedAt
        ? lastMealSharedAt.toISOString()
        : null,
      activityRank: Math.max(
        group.updatedAt.getTime(),
        lastMealSharedAt?.getTime() ?? 0
      ),
    };

    if (group.kind === 'group') {
      return {
        id: group.id,
        kind: 'group' as const,
        title: group.name ?? '',
        ...shared,
      };
    }
    const other = otherByGroupId.get(group.id);
    const title = other?.displayName?.trim() || other?.handle || '';
    return {
      id: group.id,
      kind: 'direct' as const,
      title,
      ...shared,
      avatarSeed: other?.avatarSeed ?? null,
    };
  });

  return identities
    .sort((a, b) => b.activityRank - a.activityRank)
    .map(({ activityRank: _activityRank, ...identity }) => identity);
}
