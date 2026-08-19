'use client';

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { FriendsThreadFeedPage } from '@/lib/actions/groups/types';
import {
  fetchFriendsFeedReadMarker,
  fetchFriendsThreadFeed,
} from '@/lib/domain/social/circle-client';
import {
  friendsFeedReadMarkerKeys,
  friendsThreadFeedKeys,
} from '@/lib/domain/social/query-keys';

/** The combined Friends thread — every accepted friend's shared meal, merged
 * with the actor's own shares into one feed, newest page first. Scroll up
 * (`fetchNextPage`) to load earlier shares. First page is today's or, if
 * quiet today, the most recent shares regardless of day. Deliberately
 * separate from useCircleFeed: that hook backs the sidebar's per-section
 * "New food log" subtitle and must keep its own "today, latest per friend"
 * shape — this one shows every shared meal, paginated. */
export function useFriendsThreadFeed() {
  const queryClient = useQueryClient();
  return useInfiniteQuery<FriendsThreadFeedPage>({
    queryKey: friendsThreadFeedKeys.all,
    queryFn: async ({ pageParam }) => {
      const page = await fetchFriendsThreadFeed(
        pageParam as string | undefined
      );
      // Page 1 = the thread was just opened, which marks it read server-side
      // (see listFriendsThreadFeed) — refresh FriendsRow's unread state to
      // match, same pattern useGroupMealFeed uses for chatGroupsKeys.all.
      if (pageParam === undefined) {
        queryClient.invalidateQueries({
          queryKey: friendsFeedReadMarkerKeys.all,
        });
      }
      return page;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // See useGroupMealFeed's comment: staleTime applies to the whole
    // paginated query, so 5min is the middle ground between "today's page
    // is live" and "older pages are effectively permanent."
    staleTime: 5 * 60_000,
  });
}

/** The actor's "last checked the combined Friends feed" marker — compared
 * against the latest shared meal (from useCircleFeed) to drive FriendsRow's
 * unread bold/dot. */
export function useFriendsFeedReadMarker() {
  return useQuery({
    queryKey: friendsFeedReadMarkerKeys.all,
    queryFn: fetchFriendsFeedReadMarker,
  });
}
