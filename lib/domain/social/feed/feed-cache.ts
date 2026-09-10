// ---------------------------------------------------------------------------
// Shared feed-cache helpers for optimistic share mutations
// ---------------------------------------------------------------------------
// Reactions and replies both edit the same cached feed shapes — a flat entry
// array (circle-feed) or an infinite-query page bag (friends-thread-feed,
// chat-group feed). This centralizes "which queries are feeds" and
// "apply fn to every entry" so each mutation hook only supplies its per-entry
// transform, and "find one entry across every feed" so a share's own page can
// open on what the feed behind it already holds.

import type { QueryClient } from '@tanstack/react-query';
import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';
import {
  chatGroupsKeys,
  circleFeedKeys,
  friendsThreadFeedKeys,
  shareThreadKeys,
} from '@/lib/domain/social/query-keys';

/** Invalidate every mounted Circle feed. A saved meal is shared to the circle
 * by default, so logging must refresh the feeds or the new meal only appears
 * after a reload. */
export function invalidateFeedQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => isFeedQuery(query.queryKey),
  });
}

/** True for any query whose data is a feed of share entries. Matched against
 * the key registry rather than bare literals, so renaming a root segment
 * cannot silently drop a feed out of the optimistic-update net. */
export function isFeedQuery(queryKey: readonly unknown[]): boolean {
  return (
    queryKey[0] === circleFeedKeys.all[0] ||
    queryKey[0] === friendsThreadFeedKeys.all[0] ||
    queryKey[0] === shareThreadKeys.all[0] ||
    (queryKey[0] === chatGroupsKeys.all[0] && queryKey[2] === 'feed')
  );
}

/** Map `mapEntry` over every entry of a cached feed, whether it's stored as a
 * flat array (circle-feed), an infinite-query `{ pages: [{ entries: [] }] }`
 * bag, or the single `{ entry }` a share's own page holds. Non-feed values —
 * including the `null` that page caches for a share that is gone — pass
 * through untouched. */
export function mapFeedEntries(
  value: unknown,
  mapEntry: (entry: unknown) => unknown
): unknown {
  if (Array.isArray(value)) return value.map(mapEntry);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  // One post's page: a reaction or reply landing here must reach the single
  // entry, or the thread page would show a stale count next to the feed's.
  // Checked before `pages`: the envelope is what makes a single entry
  // recognisable to a structural walker, which is why the client keeps it
  // rather than unwrapping.
  if (record.entry && typeof record.entry === 'object') {
    return { ...record, entry: mapEntry(record.entry) };
  }
  if (!Array.isArray(record.pages)) return value;
  return {
    ...record,
    pages: record.pages.map((page) => {
      if (!page || typeof page !== 'object') return page;
      const pageRecord = page as Record<string, unknown>;
      if (!Array.isArray(pageRecord.entries)) return page;
      return { ...pageRecord, entries: pageRecord.entries.map(mapEntry) };
    }),
  };
}

/** Every share entry a cached feed value holds, whatever shape it is stored
 * in — the same three `mapFeedEntries` walks (a flat array, the `{ entry }` a
 * share's own page holds, an infinite-query `{ pages: [{ entries }] }` bag)
 * plus the bare `{ entries }` page those bags are made of. */
function entriesOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (record.entry && typeof record.entry === 'object') return [record.entry];
  if (Array.isArray(record.entries)) return record.entries;
  if (Array.isArray(record.pages)) return record.pages.flatMap(entriesOf);
  return [];
}

function isEntryFor(candidate: unknown, shareId: string): boolean {
  if (!candidate || typeof candidate !== 'object') return false;
  const meal = (candidate as { meal?: { shareId?: unknown } }).meal;
  return Boolean(meal) && meal?.shareId === shareId;
}

/**
 * The post `shareId` as some mounted feed already holds it, with the moment
 * that feed was last filled. A thread page is almost always opened FROM a feed
 * — refetching what is already in memory only to draw a skeleton over it is a
 * loading state the reader never needed. The timestamp travels with the entry
 * because it is the found query's freshness, not now's: seeding
 * `initialDataUpdatedAt` with it keeps the normal staleness rules in force, so
 * an old feed still refetches in the background.
 */
export function findEntryInFeeds(
  queryClient: QueryClient,
  shareId: string
): { entry: SharedMealEntry; dataUpdatedAt: number } | undefined {
  const queries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isFeedQuery(query.queryKey) });

  for (const query of queries) {
    for (const candidate of entriesOf(query.state.data)) {
      if (isEntryFor(candidate, shareId)) {
        return {
          entry: candidate as SharedMealEntry,
          dataUpdatedAt: query.state.dataUpdatedAt,
        };
      }
    }
  }
  return undefined;
}
