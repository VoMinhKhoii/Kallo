// ---------------------------------------------------------------------------
// Group timeline — privacy-bounded meals merged with messages
// ---------------------------------------------------------------------------

import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db as defaultDb } from '@/lib/db';
import {
  chatGroupMembers,
  chatGroupMessages,
  publicProfiles,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import {
  type SharedMealCursor,
  sharedGroupMealsBefore,
  toSharedMealEntry,
} from '@/lib/groups/meal-feed';
import { reactionsForShares } from '@/lib/groups/shares/reactions';
import { groupTimelineSchema } from '@/lib/validation';
import { type ChatGroupDb, requireMembership } from './membership';
import type { GroupTimelineEntry, GroupTimelinePage } from './types';

const TIMELINE_PAGE_SIZE = 30;

const encodedCursorSchema = z.object({
  timestamp: z.string().datetime(),
  id: z.string().uuid(),
});

interface TimelineCandidate {
  id: string;
  timestamp: Date;
  entry:
    | {
        kind: 'meal';
        row: Awaited<ReturnType<typeof sharedGroupMealsBefore>>[number];
      }
    | {
        kind: 'message';
        row: {
          id: string;
          senderId: string;
          body: string;
          createdAt: Date;
          handle: string;
          displayName: string | null;
          avatarSeed: string | null;
        };
      };
}

function decodeCursor(value: string | undefined): SharedMealCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    );
    const parsed = encodedCursorSchema.parse(decoded);
    return { timestamp: new Date(parsed.timestamp), id: parsed.id };
  } catch {
    throw Errors.validationFailed('Con trỏ dòng thời gian không hợp lệ.');
  }
}

function encodeCursor(candidate: TimelineCandidate): string {
  return Buffer.from(
    JSON.stringify({
      timestamp: candidate.timestamp.toISOString(),
      id: candidate.id,
    })
  ).toString('base64url');
}

function newestFirst(a: TimelineCandidate, b: TimelineCandidate): number {
  const timeDifference = b.timestamp.getTime() - a.timestamp.getTime();
  if (timeDifference !== 0) return timeDifference;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * List one mixed group page. Meal visibility begins only after both the viewer
 * and owner joined this group; the tuple cursor orders the union itself, so a
 * millisecond tie spanning messages and shares cannot disappear between pages.
 * Page one advances lastReadAt only after every read/enrichment succeeds.
 */
export async function listGroupTimeline(
  actorId: string,
  input: { groupId: string; before?: string },
  db: ChatGroupDb = defaultDb
): Promise<GroupTimelinePage> {
  const parsed = groupTimelineSchema.parse(input);
  const before = decodeCursor(parsed.before);
  await requireMembership(actorId, parsed.groupId, db);

  const [membership] = await db
    .select({ joinedAt: chatGroupMembers.joinedAt })
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, parsed.groupId),
        eq(chatGroupMembers.userId, actorId)
      )
    )
    .limit(1);
  if (!membership) {
    throw Errors.notFound('Không tìm thấy nhóm chat.');
  }

  // The database can retain microseconds while JavaScript Date/cursors cannot.
  // Normalize the ordered expression before applying the UUID tie-breaker.
  const messageAtMs = sql<Date>`date_trunc('milliseconds', ${chatGroupMessages.createdAt})`;
  const messageViewerMembership = alias(
    chatGroupMembers,
    'message_viewer_membership'
  );
  const [mealRows, messageRows] = await Promise.all([
    sharedGroupMealsBefore(
      parsed.groupId,
      actorId,
      membership.joinedAt,
      before,
      db,
      TIMELINE_PAGE_SIZE + 1
    ),
    db
      .select({
        id: chatGroupMessages.id,
        senderId: chatGroupMessages.senderId,
        body: chatGroupMessages.body,
        createdAt: messageAtMs,
        handle: publicProfiles.handle,
        displayName: publicProfiles.displayName,
        avatarSeed: publicProfiles.avatarSeed,
      })
      .from(chatGroupMessages)
      .innerJoin(
        messageViewerMembership,
        and(
          eq(messageViewerMembership.groupId, chatGroupMessages.groupId),
          eq(messageViewerMembership.userId, actorId)
        )
      )
      .innerJoin(
        publicProfiles,
        eq(publicProfiles.userId, chatGroupMessages.senderId)
      )
      .where(
        and(
          eq(chatGroupMessages.groupId, parsed.groupId),
          before
            ? or(
                lt(messageAtMs, before.timestamp),
                and(
                  eq(messageAtMs, before.timestamp),
                  lt(chatGroupMessages.id, before.id)
                )
              )
            : undefined
        )
      )
      .orderBy(desc(messageAtMs), desc(chatGroupMessages.id))
      .limit(TIMELINE_PAGE_SIZE + 1),
  ]);

  const candidates: TimelineCandidate[] = [
    ...mealRows.map((row) => ({
      id: row.shareId,
      timestamp: row.sharedAt,
      entry: { kind: 'meal' as const, row },
    })),
    ...messageRows.map((row) => ({
      id: row.id,
      timestamp: row.createdAt,
      entry: { kind: 'message' as const, row },
    })),
  ].sort(newestFirst);
  const hasMore = candidates.length > TIMELINE_PAGE_SIZE;
  const pageCandidates = candidates.slice(0, TIMELINE_PAGE_SIZE);
  const reactions = await reactionsForShares(
    actorId,
    pageCandidates.flatMap((candidate) =>
      candidate.entry.kind === 'meal' ? [candidate.entry.row.shareId] : []
    ),
    db
  );

  const entries: GroupTimelineEntry[] = pageCandidates.map((candidate) => {
    if (candidate.entry.kind === 'meal') {
      const row = candidate.entry.row;
      return {
        type: 'meal',
        ...toSharedMealEntry(row, actorId, reactions.get(row.shareId)),
      };
    }
    const row = candidate.entry.row;
    return {
      type: 'message',
      id: row.id,
      author: {
        userId: row.senderId,
        handle: row.handle,
        displayName: row.displayName,
        avatarSeed: row.avatarSeed,
      },
      isSelf: row.senderId === actorId,
      body: row.body,
      sentAt: row.createdAt.toISOString(),
    };
  });

  // Advance the read marker only to the newest entry actually returned — never
  // to now(), which would mark read anything that arrived between the SELECTs
  // above and this UPDATE but was never shown. Skip entirely on an empty page.
  if (!parsed.before && entries.length > 0) {
    const newestReturnedAt = entries.reduce<string>((newest, entry) => {
      const ts = entry.type === 'meal' ? entry.meal.sharedAt : entry.sentAt;
      return ts > newest ? ts : newest;
    }, '');
    await db
      .update(chatGroupMembers)
      .set({
        lastReadAt: sql`GREATEST(${chatGroupMembers.lastReadAt}, ${newestReturnedAt}::timestamptz)`,
      })
      .where(
        and(
          eq(chatGroupMembers.groupId, parsed.groupId),
          eq(chatGroupMembers.userId, actorId)
        )
      );
  }

  const last = pageCandidates.at(-1);
  return {
    entries,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}
