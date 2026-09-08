'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchShareThread } from '@/lib/domain/social/circle-client';
import { findEntryInFeeds } from '@/lib/domain/social/feed/feed-cache';
import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';
import { shareThreadKeys } from '@/lib/domain/social/query-keys';

/** One share's own page: the post plus its replies, cached under its own key
 * so a reaction or reply made here reaches the mounted feeds too (the key root
 * is part of `isFeedQuery`). A share that is gone resolves to `null` data — an
 * answer the page renders, not an error to retry.
 *
 * The page is almost always opened from a feed that already holds this very
 * post, so it starts from that copy instead of drawing a skeleton over a meal
 * the reader can currently see. The seed carries the source feed's
 * `dataUpdatedAt`, not now, so staleness is judged against when the post was
 * really read and a stale one still refetches in the background. */
export function useShareThread(shareId: string) {
  const queryClient = useQueryClient();
  // Only ever consulted on a cold cache — React Query skips both callbacks
  // once this query has data of its own.
  const seeded = () => findEntryInFeeds(queryClient, shareId);

  return useQuery<{ entry: SharedMealEntry } | null>({
    queryKey: shareThreadKeys.detail(shareId),
    queryFn: () => fetchShareThread(shareId),
    initialData: () => {
      const found = seeded();
      return found ? { entry: found.entry } : undefined;
    },
    initialDataUpdatedAt: () => seeded()?.dataUpdatedAt,
    // Same window as the feed it was opened from: the post is live enough
    // while you are reading it, and its replies arrive through the mutation
    // cache rather than a refetch.
    staleTime: 5 * 60_000,
  });
}
