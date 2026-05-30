'use client';

import { useQuery } from '@tanstack/react-query';
import { type CircleFeedEntry, fetchCircleFeed } from '@/lib/groups/client';

export const circleFeedKeys = {
  all: ['circle-feed'] as const,
};

/** Poll interval (ms) for the ambient circle wall — the event spine until
 * Supabase Realtime is wired (deferred). */
const FEED_POLL_INTERVAL_MS = 30_000;

/**
 * The ambient, most-recent-per-friend wall for today. Polls on an interval
 * (no websocket — Realtime is deferred; the REST contract is unchanged when it
 * upgrades).
 */
export function useCircleFeed() {
  const timezoneOffset = new Date().getTimezoneOffset();

  return useQuery<CircleFeedEntry[]>({
    queryKey: circleFeedKeys.all,
    queryFn: () => fetchCircleFeed(timezoneOffset),
    refetchInterval: FEED_POLL_INTERVAL_MS,
  });
}
