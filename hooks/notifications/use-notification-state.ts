'use client';

import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  postMarkNotificationsRead,
  postMarkNotificationsSeen,
} from '@/lib/domain/notifications/client';
import type { NotificationFeedPage } from '@/lib/domain/notifications/contracts';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';

type FeedCache = InfiniteData<NotificationFeedPage> | undefined;

/** Bulk badge clear when Activity is opened. Pass the newest `createdAt` in
 *  the snapshot the user actually saw, so rows that land mid-visit still
 *  badge. */
export function useMarkNotificationsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (before: string) => postMarkNotificationsSeen(before),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.badge });
      queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    },
  });
}

/**
 * Dim a row on tap. Optimistic because the tap also navigates away — waiting
 * for the round trip would mean the row never visibly changes. Rolls the cache
 * back if the write fails.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => postMarkNotificationsRead(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.feed });
      const previous = queryClient.getQueryData<FeedCache>(
        notificationKeys.feed
      );
      queryClient.setQueryData<FeedCache>(notificationKeys.feed, (cache) =>
        cache ? markReadInCache(cache, ids) : cache
      );
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(notificationKeys.feed, context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.badge });
    },
  });
}

/** A read row also counts as seen — otherwise tapping straight from an unseen
 *  feed would leave the badge visibly stuck. */
function markReadInCache(
  cache: InfiniteData<NotificationFeedPage>,
  ids: string[]
): InfiniteData<NotificationFeedPage> {
  const targeted = new Set(ids);
  const now = new Date().toISOString();
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        targeted.has(item.id)
          ? { ...item, readAt: item.readAt ?? now, seenAt: item.seenAt ?? now }
          : item
      ),
    })),
  };
}
