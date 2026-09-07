'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchShareThread } from '@/lib/domain/social/circle-client';
import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';
import { shareThreadKeys } from '@/lib/domain/social/query-keys';

/** One share's own page: the post plus its replies, cached under its own key
 * so a reaction or reply made here reaches the mounted feeds too (the key root
 * is part of `isFeedQuery`). A share that is gone resolves to `null` data — an
 * answer the page renders, not an error to retry. */
export function useShareThread(shareId: string) {
  return useQuery<{ entry: SharedMealEntry } | null>({
    queryKey: shareThreadKeys.detail(shareId),
    queryFn: () => fetchShareThread(shareId),
    // Same window as the feed it was opened from: the post is live enough
    // while you are reading it, and its replies arrive through the mutation
    // cache rather than a refetch.
    staleTime: 5 * 60_000,
  });
}
