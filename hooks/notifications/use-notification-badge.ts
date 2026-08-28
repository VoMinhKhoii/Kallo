'use client';

import {
  type InfiniteData,
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchNotificationBadge } from '@/lib/domain/notifications/client';
import type { NotificationFeedPage } from '@/lib/domain/notifications/contracts';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';

/** The unseen count behind every activity entry point. Polled rather than
 *  pushed — Supabase Realtime is deliberately deferred repo-wide.
 *
 *  This poll is also the feed's only liveness signal: the badge is the one
 *  query that refetches on a timer, so the watermark it carries is how the
 *  client learns anything happened. It invalidates the feed on the way past —
 *  without that, an aggregate that re-surfaced (a refresh resets `created_at`,
 *  so the row jumps back above a cursor the reader already scrolled past) would
 *  stay out of view until something else happened to invalidate.
 *
 *  The trigger is `latestActivityAt` CHANGING, not the count rising: a silent
 *  refresh of an already-unseen aggregate moves the row without moving the
 *  count, so a count-increase rule would miss exactly the re-surfacing case it
 *  exists to heal. The watermark moves on every write, so it is strictly more
 *  sensitive and it subsumes the count rule.
 *
 *  The FIRST observation has no previous value to compare with, so it compares
 *  against the cached feed instead of baselining blind — see the effect. */
export function useNotificationBadge() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.badge,
    queryFn: fetchNotificationBadge,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const badge = query.data;
  // Undefined until the first successful poll. `null` (no rows at all) is a
  // real observed value, which is why the sentinel is `undefined`.
  const previousActivityAt = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!badge) return;
    const previous = previousActivityAt.current;
    previousActivityAt.current = badge.latestActivityAt;
    if (previous === undefined) {
      // First observation. A plain baseline would lose one specific wakeup: the
      // feed GET completes, an event commits, and this poll — the first one —
      // baselines the already-moved watermark. Nothing moves it again until the
      // next unrelated activity, so the page keeps rendering a page that is
      // known-stale right here. So instead of baselining blind, compare the
      // watermark against the feed already in cache: strictly newer means the
      // cached page missed something and has to be refetched. No cached feed
      // means there is nothing stale to heal — baseline, and stay quiet, which
      // is what keeps mounting from invalidating a fetch still in flight.
      if (isFeedBehind(queryClient, badge.latestActivityAt)) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
      }
      return;
    }
    if (previous !== badge.latestActivityAt) {
      queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    }
  }, [badge, queryClient]);

  return query;
}

/** Is the cached feed older than the watermark the badge just reported?
 *  False when no feed has been cached yet — nothing to compare, nothing to
 *  heal. An empty cached page counts as infinitely old, so any real watermark
 *  beats it. */
function isFeedBehind(
  queryClient: QueryClient,
  latestActivityAt: string | null
): boolean {
  if (latestActivityAt === null) return false;
  const cached = queryClient.getQueryData<InfiniteData<NotificationFeedPage>>(
    notificationKeys.feed
  );
  if (!cached?.pages.length) return false;
  const newestCached = Math.max(
    Number.NEGATIVE_INFINITY,
    ...cached.pages.flatMap((page) =>
      page.items.map((item) => Date.parse(item.updatedAt))
    )
  );
  return Date.parse(latestActivityAt) > newestCached;
}

/** Unseen count for the nav badge (0 while loading or on error). */
export function useUnseenNotificationCount(): number {
  const { data } = useNotificationBadge();
  return data?.unseen ?? 0;
}
