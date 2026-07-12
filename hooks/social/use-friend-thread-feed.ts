'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  type FriendThreadFeedPage,
  fetchFriendThreadFeed,
} from '@/lib/groups/client';

export const friendThreadFeedKeys = {
  byFriend: (friendUserId: string) =>
    ['friend-thread-feed', friendUserId] as const,
};

/** A 1:1 thread's shared-meal history with a friend, newest page first —
 * scroll up (`fetchNextPage`) to load earlier shares. First page is today's
 * or, if quiet today, the most recent shares regardless of day. Deliberately
 * separate from useCircleFeed: that hook backs FriendList's per-friend
 * "New food log" sidebar subtitle and must keep its own "one per friend,
 * today" shape — this one shows every shared meal, paginated. */
export function useFriendThreadFeed(friendUserId: string) {
  return useInfiniteQuery<FriendThreadFeedPage>({
    queryKey: friendThreadFeedKeys.byFriend(friendUserId),
    queryFn: ({ pageParam }) =>
      fetchFriendThreadFeed(friendUserId, pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // See useGroupMealFeed's comment: staleTime applies to the whole
    // paginated query, so 5min is the middle ground between "today's page
    // is live" and "older pages are effectively permanent."
    staleTime: 5 * 60_000,
  });
}
