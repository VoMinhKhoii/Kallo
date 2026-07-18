// ---------------------------------------------------------------------------
// Shared feed-cache helpers for optimistic share mutations
// ---------------------------------------------------------------------------
// Reactions and replies both edit the same cached feed shapes — a flat entry
// array (circle-feed) or an infinite-query page bag (friends-thread-feed,
// chat-group feed). This centralizes "which queries are feeds" and
// "apply fn to every entry" so each mutation hook only supplies its per-entry
// transform.

import type { QueryClient } from '@tanstack/react-query';

/** Invalidate every mounted Circle feed. A saved meal is shared to the circle
 * by default, so logging must refresh the feeds or the new meal only appears
 * after a reload. */
export function invalidateFeedQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => isFeedQuery(query.queryKey),
  });
}

/** True for any query whose data is a feed of share entries. */
export function isFeedQuery(queryKey: readonly unknown[]): boolean {
  return (
    queryKey[0] === 'circle-feed' ||
    queryKey[0] === 'friends-thread-feed' ||
    (queryKey[0] === 'chat-groups' && queryKey[2] === 'feed')
  );
}

/** Map `mapEntry` over every entry of a cached feed, whether it's stored as a
 * flat array or an infinite-query `{ pages: [{ entries: [] }] }` bag. Non-feed
 * values pass through untouched. */
export function mapFeedEntries(
  value: unknown,
  mapEntry: (entry: unknown) => unknown
): unknown {
  if (Array.isArray(value)) return value.map(mapEntry);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
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
