import { and, eq } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { chatGroupMembers, chatGroups, publicProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors/catalog';
import {
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/groups/public-identity';
import {
  getChatGroupSchema,
  renameChatGroupSchema,
} from '@/lib/validation/chat';
import {
  type ChatGroupDb,
  lockChatGroup,
  requireGroupAccess,
} from './membership';
import type { ChatGroupDetail } from './types';

export async function getChatGroup(
  actorId: string,
  input: { groupId: string },
  db: ChatGroupDb = defaultDb
): Promise<ChatGroupDetail> {
  const parsed = getChatGroupSchema.parse(input);
  const access = await requireGroupAccess(actorId, parsed.groupId, db);

  const [group] = await db
    .select({ id: chatGroups.id, kind: chatGroups.kind, name: chatGroups.name })
    .from(chatGroups)
    .where(eq(chatGroups.id, parsed.groupId))
    .limit(1);
  if (!group) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }

  const memberRows = await db
    .select({
      userId: chatGroupMembers.userId,
      role: chatGroupMembers.role,
      ...publicProfileColumns,
    })
    .from(chatGroupMembers)
    .leftJoin(
      publicProfiles,
      eq(publicProfiles.userId, chatGroupMembers.userId)
    )
    .where(eq(chatGroupMembers.groupId, parsed.groupId));

  return {
    id: group.id,
    kind: group.kind as 'direct' | 'group',
    name: group.name,
    members: memberRows.map((member) => ({
      ...toPublicIdentity({
        userId: member.userId,
        handle: member.handle ?? '',
        displayName: member.displayName,
        avatarSeed: member.avatarSeed,
        avatarUrl: member.avatarUrl,
        avatarPath: member.avatarPath ?? null,
      }),
      role: member.role,
    })),
    myRole: access.role,
  };
}

/** Owner-only rename. Ownership comes from the access snapshot, while the
 * group row lock serializes this with add/remove/leave from Session A. */
export async function renameChatGroup(
  actorId: string,
  input: { groupId: string; name: string },
  db: ChatGroupDb = defaultDb
): Promise<{ name: string }> {
  const parsed = renameChatGroupSchema.parse(input);

  return db.transaction(async (tx) => {
    await lockChatGroup(parsed.groupId, tx);
    const access = await requireGroupAccess(actorId, parsed.groupId, tx);
    if (access.kind !== 'group') {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }
    if (access.role !== 'owner') {
      throw Errors.validationFailed('Chỉ chủ nhóm mới có thể đổi tên nhóm.');
    }

    const [updated] = await tx
      .update(chatGroups)
      .set({ name: parsed.name })
      .where(
        and(eq(chatGroups.id, parsed.groupId), eq(chatGroups.kind, 'group'))
      )
      .returning({ name: chatGroups.name });
    if (!updated) {
      throw Errors.notFound('Không tìm thấy nhóm chat.');
    }
    return { name: updated.name ?? parsed.name };
  });
}
