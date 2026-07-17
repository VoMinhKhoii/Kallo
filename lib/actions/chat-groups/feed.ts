import { and, eq, sql } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { chatGroupMembers } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import {
  sharedGroupMealsBefore,
  toSharedMealEntry,
} from '@/lib/groups/meal-feed';
import { reactionsForShares } from '@/lib/groups/shares/reactions';
import { groupMealFeedSchema } from '@/lib/validation';
import { type ChatGroupDb, requireMembership } from './membership';
import type { GroupMealFeedPage } from './types';

const LEGACY_GROUP_FEED_PAGE_SIZE = 20;
const MIN_UUID = '00000000-0000-0000-0000-000000000000';

export async function listGroupMealFeed(
  actorId: string,
  input: { groupId: string; before?: string },
  db: ChatGroupDb = defaultDb
): Promise<GroupMealFeedPage> {
  const parsed = groupMealFeedSchema.parse(input);
  await requireMembership(actorId, parsed.groupId, db);

  const [viewer] = await db
    .select({
      joinedAt: chatGroupMembers.joinedAt,
    })
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, parsed.groupId),
        eq(chatGroupMembers.userId, actorId)
      )
    );
  if (!viewer) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }
  const before = parsed.before
    ? { timestamp: new Date(parsed.before), id: MIN_UUID }
    : null;

  // This endpoint remains for older clients. It deliberately shares the
  // timeline's post-join policy so it cannot bypass that privacy boundary.
  const candidates = await sharedGroupMealsBefore(
    parsed.groupId,
    actorId,
    viewer.joinedAt,
    before,
    db,
    LEGACY_GROUP_FEED_PAGE_SIZE + 1
  );
  const hasMore = candidates.length > LEGACY_GROUP_FEED_PAGE_SIZE;
  const rows = hasMore
    ? candidates.slice(0, LEGACY_GROUP_FEED_PAGE_SIZE)
    : candidates;
  const last = rows.at(-1);
  const nextCursor = hasMore && last ? last.sharedAt.toISOString() : null;

  const reactions = await reactionsForShares(
    actorId,
    rows.map((row) => row.shareId),
    db
  );

  // Advance only after the complete read/enrichment succeeds.
  if (!parsed.before) {
    await db
      .update(chatGroupMembers)
      .set({
        lastReadAt: sql`GREATEST(${chatGroupMembers.lastReadAt}, now())`,
      })
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      );
  }

  return {
    entries: rows.map((row) =>
      toSharedMealEntry(row, actorId, reactions.get(row.shareId))
    ),
    nextCursor,
  };
}
