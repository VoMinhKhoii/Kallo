'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchNotificationBadge } from '@/lib/domain/notifications/client';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';

/** The unseen count behind every activity entry point. Polled rather than
 *  pushed — Supabase Realtime is deliberately deferred repo-wide.
 *
 *  This poll is also the feed's only liveness signal: the badge is the one
 *  query that refetches on a timer, so a rise in the unseen count is how the
 *  client learns anything happened. It invalidates the feed on the way past —
 *  without that, an aggregate that re-surfaced (a refresh resets `created_at`,
 *  so the row jumps back above a cursor the reader already scrolled past) would
 *  stay out of view until something else happened to invalidate. */
export function useNotificationBadge() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.badge,
    queryFn: fetchNotificationBadge,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const unseen = query.data?.unseen;
  // Undefined until the first successful poll, so the first count is a
  // baseline, never an "increase" — mounting must not invalidate the feed the
  // page is in the middle of fetching.
  const previousUnseen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (unseen === undefined) return;
    const previous = previousUnseen.current;
    previousUnseen.current = unseen;
    if (previous !== undefined && unseen > previous) {
      queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    }
  }, [unseen, queryClient]);

  return query;
}

/** Unseen count for the nav badge (0 while loading or on error). */
export function useUnseenNotificationCount(): number {
  const { data } = useNotificationBadge();
  return data?.unseen ?? 0;
}
