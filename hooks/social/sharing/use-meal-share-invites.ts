'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';
import { loggingDayKeys } from '@/lib/domain/meals/query-keys';
import {
  acceptMealShareInvite,
  dismissMealShareInvite,
  fetchMealShareInvites,
  stageCheatMealShareInvite,
} from '@/lib/domain/social/circle-client';
import {
  circleFeedKeys,
  mealShareInvitesKeys,
} from '@/lib/domain/social/query-keys';

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

/**
 * Accept an offer. The copy lands at the SOURCE meal's instant, not today — the
 * same eating event seen from my diary — so it can land on an earlier day.
 * `loggedDate`/`timezoneOffset` are still sent for shipped clients and ignored
 * by the server. That is why the invalidation below targets `loggingDayKeys.all`
 * rather than today's key: `.all` is a prefix, so every cached day refetches and
 * the meal shows up wherever it actually landed.
 */
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

/**
 * Take a CHEAT invite: reopen the sender's sliders instead of logging their
 * numbers. Nothing lands in the diary here — the caller routes to the logging
 * feed, where the staged card waits on the day the meal was eaten, and the
 * meal is created only when the recipient confirms their own amounts.
 *
 * Invalidates the day queries so the staged card is already in cache when
 * `/logging` mounts, rather than appearing a beat later.
 */
export function useStageCheatMealShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => stageCheatMealShareInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealShareInvitesKeys.all });
      queryClient.invalidateQueries({ queryKey: loggingDayKeys.all });
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
