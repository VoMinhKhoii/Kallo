import { and, eq, sql } from 'drizzle-orm';
import { groupMealFeedSchema } from '@/lib/core/validation/chat';
import {
  decodeSharedMealCursor,
  encodeSharedMealCursor,
} from '@/lib/domain/social/feed/cursor';
import { sharedGroupMealsBefore } from '@/lib/domain/social/feed/group-meals';
import { toSharedMealEntry } from '@/lib/domain/social/feed/meal-feed';
import { reactionsForShares } from '@/lib/domain/social/shares/reactions';
import { repliesForShares } from '@/lib/domain/social/shares/replies';
import { db as defaultDb } from '@/lib/infra/db/client';
import { chatGroupMembers } from '@/lib/infra/db/schema';
import { type ChatGroupDb, requireGroupAccess } from './membership';
import type { GroupMealFeedPage } from './types';

const LEGACY_GROUP_FEED_PAGE_SIZE = 20;

export async function listGroupMealFeed(
  actorId: string,
  input: { groupId: string; before?: string },
  db: ChatGroupDb = defaultDb
): Promise<GroupMealFeedPage> {
  const parsed = groupMealFeedSchema.parse(input);
  const access = await requireGroupAccess(actorId, parsed.groupId, db);
  const before = decodeSharedMealCursor(parsed.before);

  // The feed applies the same post-join policy as every group share read.
  const candidates = await sharedGroupMealsBefore(
    parsed.groupId,
    actorId,
    access.joinedAt,
    before,
    db,
    LEGACY_GROUP_FEED_PAGE_SIZE + 1
  );
  const hasMore = candidates.length > LEGACY_GROUP_FEED_PAGE_SIZE;
  const rows = hasMore
    ? candidates.slice(0, LEGACY_GROUP_FEED_PAGE_SIZE)
    : candidates;
  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeSharedMealCursor({ ts: last.sharedAtText, id: last.shareId })
      : null;

  const shareIds = rows.map((row) => row.shareId);
  const [reactions, replies] = await Promise.all([
    reactionsForShares(actorId, shareIds, db),
    repliesForShares(actorId, shareIds, db),
  ]);
  const entries = rows.map((row) =>
    toSharedMealEntry(
      row,
      actorId,
      reactions.get(row.shareId),
      replies.get(row.shareId)
    )
  );

  // Advance only after the complete read/enrichment succeeds.
  const newest = rows[0];
  if (!parsed.before && newest) {
    await db
      .update(chatGroupMembers)
      .set({
        lastReadAt: sql`GREATEST(${chatGroupMembers.lastReadAt}, ${newest.sharedAt.toISOString()}::timestamptz)`,
      })
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      );
  }

  return { entries, nextCursor };
}
