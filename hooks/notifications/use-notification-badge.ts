'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchNotificationBadge } from '@/lib/domain/notifications/client';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';

/** The unseen count behind every activity entry point. Polled rather than
 *  pushed — Supabase Realtime is deferred repo-wide. */
export function useNotificationBadge() {
  return useQuery({
    queryKey: notificationKeys.badge,
    queryFn: fetchNotificationBadge,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/** Unseen count for the nav badge (0 while loading or on error). */
export function useUnseenNotificationCount(): number {
  const { data } = useNotificationBadge();
  return data?.unseen ?? 0;
}
