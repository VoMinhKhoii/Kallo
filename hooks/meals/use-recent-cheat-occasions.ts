'use client';

import { useQuery } from '@tanstack/react-query';
import { loadRecentCheatOccasionsAction } from '@/lib/actions/meals/cheat';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';

export const recentCheatOccasionsKeys = {
  all: ['recent-cheat-occasions'] as const,
  byUser: (userId: string) => ['recent-cheat-occasions', userId] as const,
};

/**
 * Recent, de-duplicated cheat occasions for the "log it again" chips. Fetched
 * lazily — only enabled while the user is in cheat mode.
 */
export function useRecentCheatOccasions(userId: string, enabled: boolean) {
  return useQuery<RecentCheatOccasion[]>({
    queryKey: recentCheatOccasionsKeys.byUser(userId),
    queryFn: () => loadRecentCheatOccasionsAction({ limit: 5 }),
    enabled,
    staleTime: 60_000,
  });
}
