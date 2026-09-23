import { eq, getTableColumns } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppDb } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
} from '@/lib/infra/db/schema';

const mine = alias(chatGroupMembers, 'my_membership');

/**
 * Group and direct chats: every chat the user belongs to or created, and every
 * message the user sent.
 *
 * Other members appear only as user ids (the roster the app already shows the
 * user); their messages are their content and stay out. A chat the user
 * created and later left is still listed, since `created_by` keeps pointing at
 * them.
 */
export async function loadChatExport(db: AppDb, userId: string) {
  const [membershipRows, createdRows, rosterRows, messageRows] =
    await Promise.all([
      db
        .select({
          group: getTableColumns(chatGroups),
          role: chatGroupMembers.role,
          joinedAt: chatGroupMembers.joinedAt,
          lastReadAt: chatGroupMembers.lastReadAt,
        })
        .from(chatGroupMembers)
        .innerJoin(chatGroups, eq(chatGroupMembers.groupId, chatGroups.id))
        .where(eq(chatGroupMembers.userId, userId)),
      db.select().from(chatGroups).where(eq(chatGroups.createdBy, userId)),
      // Rosters of the user's own chats only: the self-join admits a member
      // row solely when the caller is in the same group.
      db
        .select({
          groupId: chatGroupMembers.groupId,
          userId: chatGroupMembers.userId,
        })
        .from(chatGroupMembers)
        .innerJoin(mine, eq(mine.groupId, chatGroupMembers.groupId))
        .where(eq(mine.userId, userId)),
      db
        .select({
          id: chatGroupMessages.id,
          groupId: chatGroupMessages.groupId,
          body: chatGroupMessages.body,
          createdAt: chatGroupMessages.createdAt,
        })
        .from(chatGroupMessages)
        .where(eq(chatGroupMessages.senderId, userId)),
    ]);

  const rosters = new Map<string, string[]>();
  for (const row of rosterRows) {
    const bucket = rosters.get(row.groupId);
    if (bucket) bucket.push(row.userId);
    else rosters.set(row.groupId, [row.userId]);
  }

  const toGroup = (
    group: typeof chatGroups.$inferSelect,
    membership: {
      role: string;
      joinedAt: Date;
      lastReadAt: Date;
    } | null
  ) => ({
    id: group.id,
    kind: group.kind,
    name: group.name,
    avatarSeed: group.avatarSeed,
    createdByMe: group.createdBy === userId,
    myRole: membership?.role ?? null,
    joinedAt: membership?.joinedAt ?? null,
    lastReadAt: membership?.lastReadAt ?? null,
    memberUserIds: rosters.get(group.id) ?? [],
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  });

  const groups = membershipRows.map(({ group, ...membership }) =>
    toGroup(group, membership)
  );
  const seen = new Set(groups.map((group) => group.id));
  for (const group of createdRows) {
    if (!seen.has(group.id)) groups.push(toGroup(group, null));
  }

  return { groups, messagesSent: messageRows };
}
