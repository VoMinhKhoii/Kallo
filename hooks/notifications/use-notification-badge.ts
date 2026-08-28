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
 *  against the cached feed instead of baselining blind — and when the feed is
 *  still in flight, it HOLDS the watermark until a page lands rather than
 *  consuming it. See the effect. */
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
  // A first-observation watermark that arrived while the feed request was still
  // open, kept until a page reaches the cache and can be compared with it.
  // `null` means nothing is held.
  const heldWatermark = useRef<string | null>(null);

  useEffect(() => {
    if (!badge) return;
    const invalidateFeed = () => {
      heldWatermark.current = null;
      queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    };
    const previous = previousActivityAt.current;
    previousActivityAt.current = badge.latestActivityAt;

    if (previous === undefined) {
      // First observation. A plain baseline would lose one specific wakeup: the
      // feed GET completes, an event commits, and this poll — the first one —
      // baselines the already-moved watermark. Nothing moves it again until the
      // next unrelated activity, so the page keeps rendering a feed that is
      // known-stale right here. So instead of baselining blind, compare the
      // watermark against the feed already in cache: strictly newer means the
      // cached page missed something and has to be refetched.
      //
      // With NO cached feed the comparison cannot be made yet — and the reason
      // is usually that the feed request is still open, which is exactly the
      // window where its response is about to land already stale. Discarding
      // the watermark here would swallow that case (the response populates the
      // cache uninvalidated and the watermark may never move again). So it is
      // held, and judged below the moment a page appears.
      const newest = newestCachedActivity(queryClient);
      if (newest === undefined) {
        heldWatermark.current = badge.latestActivityAt;
      } else if (isNewer(badge.latestActivityAt, newest)) {
        invalidateFeed();
      }
    } else if (previous !== badge.latestActivityAt) {
      invalidateFeed();
    }

    // The held watermark can only be judged against a cached page, and the
    // badge may never poll a different value again, so the cache itself drives
    // the resolution: the check runs on the settle that populates the feed,
    // not on the next 30s tick.
    return queryClient.getQueryCache().subscribe(() => {
      const held = heldWatermark.current;
      if (held === null) return;
      const newest = newestCachedActivity(queryClient);
      if (newest === undefined) return;
      heldWatermark.current = null;
      if (isNewer(held, newest)) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
      }
    });
  }, [badge, queryClient]);

  return query;
}

/** Newest `updatedAt` across the cached feed pages, in epoch ms. `undefined`
 *  when no feed is cached at all — nothing to compare against, request very
 *  possibly still in flight. A cached-but-empty feed is infinitely old, so any
 *  real watermark beats it. */
function newestCachedActivity(queryClient: QueryClient): number | undefined {
  const cached = queryClient.getQueryData<InfiniteData<NotificationFeedPage>>(
    notificationKeys.feed
  );
  if (!cached?.pages.length) return undefined;
  return Math.max(
    Number.NEGATIVE_INFINITY,
    ...cached.pages.flatMap((page) =>
      page.items.map((item) => Date.parse(item.updatedAt))
    )
  );
}

/** A null watermark (empty inbox) can never be newer than anything. */
const isNewer = (watermark: string | null, newestCached: number): boolean =>
  watermark !== null && Date.parse(watermark) > newestCached;

/** Unseen count for the nav badge (0 while loading or on error). */
export function useUnseenNotificationCount(): number {
  const { data } = useNotificationBadge();
  return data?.unseen ?? 0;
}
