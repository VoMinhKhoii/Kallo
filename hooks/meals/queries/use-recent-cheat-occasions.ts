'use client';

import { useQuery } from '@tanstack/react-query';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';
import { fetchRecentCheatOccasions } from '@/lib/domain/meals/meals-client';
import { recentCheatOccasionsKeys } from '@/lib/domain/meals/query-keys';

/**
 * Recent, de-duplicated cheat occasions for the "log it again" chips. Fetched
 * lazily — only enabled while the user is in cheat mode.
 */
export function useRecentCheatOccasions(userId: string, enabled: boolean) {
  return useQuery<RecentCheatOccasion[]>({
    queryKey: recentCheatOccasionsKeys.byUser(userId),
    queryFn: () => fetchRecentCheatOccasions({ limit: 5 }),
    enabled,
    staleTime: 60_000,
  });
}
