import { and, desc, eq } from 'drizzle-orm';
import { after } from 'next/server';
import { Errors } from '@/lib/core/errors/catalog';
import {
  getChatGroupSchema,
  sendChatGroupMessageSchema,
} from '@/lib/core/validation/chat';
import { sendChatMessagePush } from '@/lib/domain/notifications/push';
import { assertUnlimitedCircleActor } from '@/lib/domain/social/quota/circle-quota';
import { db as defaultDb } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
} from '@/lib/infra/db/schema';
import { type ChatGroupDb, requireGroupAccess } from './membership';
import type { ChatGroupMessage } from './types';

/** Most-recent messages loaded per thread open — no cursor yet (deferred). */
const MESSAGE_PAGE_SIZE = 30;

export async function listChatGroupMessages(
  actorId: string,
  input: { groupId: string },
  db: ChatGroupDb = defaultDb
): Promise<ChatGroupMessage[]> {
  const parsed = getChatGroupSchema.parse(input);
  await requireGroupAccess(actorId, parsed.groupId, db);

  const [rows] = await Promise.all([
    db
      .select({
        id: chatGroupMessages.id,
        groupId: chatGroupMessages.groupId,
        senderId: chatGroupMessages.senderId,
        body: chatGroupMessages.body,
        createdAt: chatGroupMessages.createdAt,
      })
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.groupId, parsed.groupId))
      .orderBy(desc(chatGroupMessages.createdAt), desc(chatGroupMessages.id))
      .limit(MESSAGE_PAGE_SIZE),
    db
      .update(chatGroupMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      ),
  ]);

  return rows.reverse().map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function sendChatGroupMessage(
  actorId: string,
  input: { groupId: string; body: string },
  db: ChatGroupDb = defaultDb
): Promise<ChatGroupMessage> {
  const parsed = sendChatGroupMessageSchema.parse(input);
  const access = await requireGroupAccess(actorId, parsed.groupId, db);
  // Group chat is premium; 1:1 direct chats stay free.
  if (access.kind === 'group') {
    await assertUnlimitedCircleActor(db, actorId);
  }

  // The message, the activity bump and the push audience are ONE transaction:
  // a member who joins between the write and the audience capture must not be
  // handed a preview of a message sent before they were in the room. Sharing a
  // transaction is not on its own enough for that (READ COMMITTED gives each
  // statement a fresh snapshot) — what serialises it is the chat_groups row.
  // The bump takes that row's write lock FIRST, and every membership change
  // (addChatGroupMembers / removeChatGroupMember) opens with the same
  // `lockChatGroup` FOR UPDATE, so a concurrent join either lands entirely
  // before this message exists or entirely after this audience was read.
  const { row, recipientIds } = await db.transaction(async (tx) => {
    await tx
      .update(chatGroups)
      .set({ updatedAt: new Date() })
      .where(eq(chatGroups.id, parsed.groupId));

    const [message] = await tx
      .insert(chatGroupMessages)
      .values({
        groupId: parsed.groupId,
        senderId: actorId,
        body: parsed.body,
      })
      .returning();

    // Full member list (sender included) read under the lock: it both
    // re-verifies the sender's membership — requireGroupAccess above ran
    // before the lock, so a concurrent removal could have landed since —
    // and derives the push audience from the same snapshot.
    const members = await tx
      .select({ userId: chatGroupMembers.userId })
      .from(chatGroupMembers)
      .where(eq(chatGroupMembers.groupId, parsed.groupId));
    if (!members.some((member) => member.userId === actorId)) {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }

    return {
      row: message,
      recipientIds: members
        .filter((member) => member.userId !== actorId)
        .map((member) => member.userId),
    };
  });

  // Push only, never a notification row: chat unread is already carried by
  // chat_group_members.lastReadAt, and a row here would double-badge (Gate 3).
  after(() =>
    sendChatMessagePush({
      groupId: parsed.groupId,
      senderId: actorId,
      preview: parsed.body,
      recipientIds,
    })
  );

  return { ...row, createdAt: row.createdAt.toISOString() };
}
