import { and, eq } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { chatGroupMembers } from '@/lib/db/schema';
import { sharedMealsBefore, toSharedMealEntry } from '@/lib/groups/meal-feed';
import { groupMealFeedSchema } from '@/lib/validation';
import { type ChatGroupDb, requireMembership } from './membership';
import type { GroupMealFeedPage } from './types';

export async function listGroupMealFeed(
  actorId: string,
  input: { groupId: string; before?: string },
  db: ChatGroupDb = defaultDb
): Promise<GroupMealFeedPage> {
  const parsed = groupMealFeedSchema.parse(input);
  await requireMembership(actorId, parsed.groupId, db);

  const memberRows = await db
    .select({ userId: chatGroupMembers.userId })
    .from(chatGroupMembers)
    .where(eq(chatGroupMembers.groupId, parsed.groupId));
  const memberIds = memberRows.map((row) => row.userId);
  const before = parsed.before ? new Date(parsed.before) : null;

  // Opening page one is the read receipt; loading older pages leaves it alone.
  const [{ rows, nextCursor }] = await Promise.all([
    sharedMealsBefore(memberIds, before, db),
    parsed.before
      ? Promise.resolve(undefined)
      : db
          .update(chatGroupMembers)
          .set({ lastReadAt: new Date() })
          .where(
            and(
              eq(chatGroupMembers.groupId, parsed.groupId),
              eq(chatGroupMembers.userId, actorId)
            )
          ),
  ]);

  return {
    entries: rows.map((row) => toSharedMealEntry(row, actorId)),
    nextCursor,
  };
}
