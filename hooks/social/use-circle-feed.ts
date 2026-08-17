'use client';

import { useQuery } from '@tanstack/react-query';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { fetchCircleFeed } from '@/lib/domain/social/circle-client';

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
    // Offset is part of the key so a changed tz (DST/travel) can't serve a
    // stale-day feed; invalidating circleFeedKeys.all still matches the prefix.
    queryKey: [...circleFeedKeys.all, timezoneOffset],
    queryFn: () => fetchCircleFeed(timezoneOffset),
    refetchInterval: FEED_POLL_INTERVAL_MS,
  });
}
