// ---------------------------------------------------------------------------
// Shared feed-cache helpers for optimistic share mutations
// ---------------------------------------------------------------------------
// Reactions and replies both edit the same cached feed shapes — a flat entry
// array (circle-feed) or an infinite-query page bag (friends-thread-feed,
// chat-group feed). This centralizes "which queries are feeds" and
// "apply fn to every entry" so each mutation hook only supplies its per-entry
// transform.

import type { QueryClient } from '@tanstack/react-query';
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
