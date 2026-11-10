import { and, eq, sql } from 'drizzle-orm';
import { groupMealFeedSchema } from '@/lib/core/validation/chat';
import { decodeSharedMealCursor } from '@/lib/domain/social/feed/cursor';
import {
  newestGroupSharedAt,
  sharedGroupMealsBefore,
} from '@/lib/domain/social/feed/group-meals';
import {
  feedCursorAfter,
  toSharedMealEntry,
} from '@/lib/domain/social/feed/meal-feed';
import { reactionsForShares } from '@/lib/domain/social/shares/reactions';
import { repliesForShares } from '@/lib/domain/social/shares/replies';
import { db as defaultDb } from '@/lib/infra/db/client';
import { chatGroupMembers } from '@/lib/infra/db/schema';
import { ServerTiming } from '@/lib/infra/http/server-timing';
import { type ChatGroupDb, requireGroupAccess } from './membership';
import type { GroupMealFeedPage } from './types';

const LEGACY_GROUP_FEED_PAGE_SIZE = 20;

export async function listGroupMealFeed(
  actorId: string,
  input: { groupId: string; before?: string; order?: string },
  db: ChatGroupDb = defaultDb,
  timing = new ServerTiming()
): Promise<GroupMealFeedPage> {
  const parsed = groupMealFeedSchema.parse(input);
  const before = decodeSharedMealCursor(parsed.before);

  // Page one is "caught up": read the newest share before the page so the
  // marker never passes a share the page could not have seen.
  // The marker query independently enforces viewer membership/visibility.
  // Overlap its read with access validation, but never load the page or write
  // a marker unless access succeeds. Both finish before the page starts.
  const [, caughtUpTo] = await Promise.all([
    timing.measure('access', () =>
      requireGroupAccess(actorId, parsed.groupId, db)
    ),
    parsed.before
      ? Promise.resolve(null)
      : timing.measure('marker', () =>
          newestGroupSharedAt(parsed.groupId, actorId, db)
        ),
  ]);

  // The feed applies the same group-share rule as every group share read.
  const candidates = await timing.measure('page', () =>
    sharedGroupMealsBefore(
      parsed.groupId,
      actorId,
      before,
      db,
      LEGACY_GROUP_FEED_PAGE_SIZE + 1,
      parsed.order
    )
  );
  const hasMore = candidates.length > LEGACY_GROUP_FEED_PAGE_SIZE;
  const rows = hasMore
    ? candidates.slice(0, LEGACY_GROUP_FEED_PAGE_SIZE)
    : candidates;
  const last = rows.at(-1);
  const nextCursor =
    hasMore && last ? feedCursorAfter(parsed.order, last) : null;

  const shareIds = rows.map((row) => row.shareId);
  const [reactions, replies] = await timing.measure('enrichment', () =>
    Promise.all([
      reactionsForShares(actorId, shareIds, db),
      repliesForShares(actorId, shareIds, db),
    ])
  );
  const entries = rows.map((row) =>
    toSharedMealEntry(
      row,
      actorId,
      reactions.get(row.shareId),
      replies.get(row.shareId)
    )
  );

  // Advance only after the complete read/enrichment succeeds.
  if (caughtUpTo) {
    await timing.measure('read', async () => {
      await db
        .update(chatGroupMembers)
        .set({
          lastReadAt: sql`GREATEST(${chatGroupMembers.lastReadAt}, ${caughtUpTo.toISOString()}::timestamptz)`,
        })
        .where(
          and(
            eq(chatGroupMembers.groupId, parsed.groupId),
            eq(chatGroupMembers.userId, actorId)
          )
        );
    });
  }

  return {
    entries,
    nextCursor,
    readThroughAt: caughtUpTo?.toISOString() ?? null,
  };
}
