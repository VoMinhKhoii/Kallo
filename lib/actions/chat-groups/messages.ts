import { and, desc, eq } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
} from '@/lib/db/schema';
import {
  getChatGroupSchema,
  sendChatGroupMessageSchema,
} from '@/lib/validation/chat';
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
  await requireGroupAccess(actorId, parsed.groupId, db);

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

  return { ...row, createdAt: row.createdAt.toISOString() };
}
