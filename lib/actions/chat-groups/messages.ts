import { and, desc, eq } from 'drizzle-orm';
import { after } from 'next/server';
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

  const [row] = await db
    .insert(chatGroupMessages)
    .values({
      groupId: parsed.groupId,
      senderId: actorId,
      body: parsed.body,
    })
    .returning();

  await db
    .update(chatGroups)
    .set({ updatedAt: new Date() })
    .where(eq(chatGroups.id, parsed.groupId));

  // Push only, never a notification row: chat unread is already carried by
  // chat_group_members.lastReadAt, and a row here would double-badge (Gate 3).
  after(() =>
    sendChatMessagePush({
      groupId: parsed.groupId,
      senderId: actorId,
      preview: parsed.body,
    })
  );

  return { ...row, createdAt: row.createdAt.toISOString() };
}
