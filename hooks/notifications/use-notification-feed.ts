'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchNotifications } from '@/lib/domain/notifications/client';
import type { NotificationFeedPage } from '@/lib/domain/notifications/contracts';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';

/** The activity feed, newest page first; `fetchNextPage` loads older rows.
 *  Short staleTime because the first page is the live surface — the badge
 *  polls on the same cadence, so an arriving notification shows up in both
 *  within the same window. */
export function useNotificationFeed() {
  return useInfiniteQuery<NotificationFeedPage>({
    queryKey: notificationKeys.feed,
    queryFn: ({ pageParam }) =>
      fetchNotifications(pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
