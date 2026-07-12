'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  type FriendsThreadFeedPage,
  fetchFriendsThreadFeed,
} from '@/lib/groups/client';

export const friendsThreadFeedKeys = {
  all: ['friends-thread-feed'] as const,
};

/** The combined Friends thread — every accepted friend's shared meal, merged
 * into one feed (excluding the actor's own), newest page first. Scroll up
 * (`fetchNextPage`) to load earlier shares. First page is today's or, if
 * quiet today, the most recent shares regardless of day. Deliberately
 * separate from useCircleFeed: that hook backs the sidebar's per-section
 * "New food log" subtitle and must keep its own "today, latest per friend"
 * shape — this one shows every shared meal, paginated. No read-marker/
 * sidebar-invalidation on open (unlike useGroupMealFeed) — this isn't a
 * real chat_groups row, so there's no unread state to clear yet. */
export function useFriendsThreadFeed() {
  return useInfiniteQuery<FriendsThreadFeedPage>({
    queryKey: friendsThreadFeedKeys.all,
    queryFn: ({ pageParam }) =>
      fetchFriendsThreadFeed(pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // See useGroupMealFeed's comment: staleTime applies to the whole
    // paginated query, so 5min is the middle ground between "today's page
    // is live" and "older pages are effectively permanent."
    staleTime: 5 * 60_000,
  });
}
