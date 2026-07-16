import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import { db as defaultDb } from '@/lib/db';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { todayLocalDate } from '@/lib/groups/meal-feed';
import { circleFeedSchema, createChatGroupSchema } from '@/lib/validation';
import {
  type ChatGroupDb,
  ensureDirectChatsForAcceptedFriends,
  isAcceptedFriend,
  requireMembership,
} from './membership';
import type { ChatGroupDetail, ChatGroupIdentity } from './types';

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

  const acceptedChecks = await Promise.all(
    memberIds.map((memberId) => isAcceptedFriend(actorId, memberId, db))
  );
  if (acceptedChecks.some((accepted) => !accepted)) {
    throw Errors.validationFailed(
      'Chỉ có thể thêm bạn bè đã kết nối vào nhóm.'
    );
  }

  return db.transaction(async (tx) => {
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
      lastReadAt: chatGroupMembers.lastReadAt,
      directUserLow: chatGroups.directUserLow,
      directUserHigh: chatGroups.directUserHigh,
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
            desc(chatGroupMessages.createdAt)
          ),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            groupId: chatGroupMembers.groupId,
            lastSharedAt: sql<Date>`max(${mealShares.sharedAt})`,
          })
          .from(chatGroupMembers)
          .innerJoin(meals, eq(meals.userId, chatGroupMembers.userId))
          .innerJoin(mealShares, eq(mealShares.mealId, meals.id))
          .where(
            and(
              inArray(chatGroupMembers.groupId, groupIds),
              sql`${mealShares.visibility} <> 'private'`,
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
    const messageUnread = lastMessage
      ? lastMessage.createdAt > group.lastReadAt
      : false;
    const mealUnread = lastMealSharedAt
      ? lastMealSharedAt > group.lastReadAt
      : false;
    const shared = {
      avatarSeed: group.avatarSeed,
      updatedAt: group.updatedAt.toISOString(),
      lastMessagePreview: lastMessage?.body ?? null,
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
      unread: messageUnread || mealUnread,
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

export async function getChatGroup(
  actorId: string,
  input: { groupId: string },
  db: ChatGroupDb = defaultDb
): Promise<ChatGroupDetail> {
  await requireMembership(actorId, input.groupId, db);

  const [group] = await db
    .select({ id: chatGroups.id, kind: chatGroups.kind, name: chatGroups.name })
    .from(chatGroups)
    .where(eq(chatGroups.id, input.groupId))
    .limit(1);
  if (!group) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }

  const memberRows = await db
    .select({
      userId: chatGroupMembers.userId,
      role: chatGroupMembers.role,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
    })
    .from(chatGroupMembers)
    .innerJoin(
      publicProfiles,
      eq(publicProfiles.userId, chatGroupMembers.userId)
    )
    .where(eq(chatGroupMembers.groupId, input.groupId));

  return {
    id: group.id,
    kind: group.kind as 'direct' | 'group',
    name: group.name,
    members: memberRows,
  };
}
