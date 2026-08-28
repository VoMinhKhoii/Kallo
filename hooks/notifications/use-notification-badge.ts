'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchNotificationBadge } from '@/lib/domain/notifications/client';
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
 *  sensitive and it subsumes the count rule. */
export function useNotificationBadge() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.badge,
    queryFn: fetchNotificationBadge,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const badge = query.data;
  // Undefined until the first successful poll, so the first watermark is a
  // baseline, never a change — mounting must not invalidate the feed the page
  // is in the middle of fetching. `null` (no rows at all) is a real observed
  // value, which is why the sentinel is `undefined`.
  const previousActivityAt = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!badge) return;
    const previous = previousActivityAt.current;
    previousActivityAt.current = badge.latestActivityAt;
    if (previous !== undefined && previous !== badge.latestActivityAt) {
      queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    }
  }, [badge, queryClient]);

  return query;
}

/** Unseen count for the nav badge (0 while loading or on error). */
export function useUnseenNotificationCount(): number {
  const { data } = useNotificationBadge();
  return data?.unseen ?? 0;
}
