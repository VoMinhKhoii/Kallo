'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import { circleFeedKeys } from '@/hooks/social/use-circle-feed';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';
import {
  acceptMealShareInvite,
  dismissMealShareInvite,
  fetchMealShareInvites,
} from '@/lib/domain/social/circle-client';

export const mealShareInvitesKeys = {
  all: ['meal-share-invites'] as const,
};

/** Local calendar date (YYYY-MM-DD) — the day the accepted meal is stamped. */
function localDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Pending copy/split offers addressed to me. */
export function useMealShareInvites() {
  return useQuery<MealShareInvite[]>({
    queryKey: mealShareInvitesKeys.all,
    queryFn: fetchMealShareInvites,
    staleTime: 30_000,
  });
}

/** Pending-invite count for the nav badge (0 while loading or on error). */
export function useMealShareInviteCount(): number {
  const { data } = useMealShareInvites();
  return data?.length ?? 0;
}

/** Accept an offer — it lands in today's diary; refresh the day + wall. */
export function useAcceptMealShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      acceptMealShareInvite({
        inviteId,
        loggedDate: localDateString(),
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealShareInvitesKeys.all });
      queryClient.invalidateQueries({ queryKey: loggingDayKeys.all });
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}

export function useDismissMealShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => dismissMealShareInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealShareInvitesKeys.all });
    },
  });
}
