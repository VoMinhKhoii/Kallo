'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  applyOptimisticMeal,
  reconcileSavedMeal,
  rollbackOptimisticMeal,
  settleMealSave,
} from '@/hooks/meals/meal-save-choreography';
import {
  buildOptimisticRelogMeal,
  type RelogMealVariables,
} from '@/hooks/meals/relog/build-optimistic-relog-meal';
import { relogCandidatesKeys } from '@/hooks/meals/relog/use-relog-candidates';
import { relogMealItemsAction } from '@/lib/actions/meals/relog/relog-items';

/**
 * Commit the staged relog entries as one meal.
 *
 * Cache choreography is the shared one (confirm / manual / duplicate all use
 * it): `onMutate` cancels in-flight day fetches BEFORE seeding — such a fetch
 * read the pre-save snapshot and would clobber the authoritative `onSuccess`
 * write — and `onSettled` marks the day stale without a refetch on success.
 *
 * The extra invalidation key refreshes the picker itself: the dish just logged
 * gains an occurrence and becomes more recent, so its ranking changes. Mirrors
 * the `recent-cheat-occasions` key on useConfirmMeal.
 */
export function useRelogMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (v: RelogMealVariables) =>
      relogMealItemsAction({
        newMealId: v.newMealId,
        items: v.entries.map((entry) => entry.ref),
        loggedDate: v.loggedDate,
        timezoneOffset: v.timezoneOffset,
      }),
    onMutate: (v) =>
      applyOptimisticMeal(
        queryClient,
        userId,
        v.originDate,
        buildOptimisticRelogMeal(v)
      ),
    onSuccess: (data, v, context) =>
      reconcileSavedMeal(
        queryClient,
        userId,
        v.originDate,
        data.meal,
        undefined,
        context?.snapshots,
        context?.dayFetchCancelled
      ),
    onError: (error, _v, context) =>
      rollbackOptimisticMeal(queryClient, error, context),
    onSettled: (_data, error, v) =>
      settleMealSave(queryClient, userId, v.originDate, error, [
        relogCandidatesKeys.all,
      ]),
  });
}
