'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { duplicateMealAction } from '@/lib/actions/meals/duplicate-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import {
  applyOptimisticMeal,
  reconcileSavedMeal,
  rollbackOptimisticMeal,
  settleMealSave,
} from '@/lib/domain/meals/save/save-choreography';

interface DuplicateMealVariables {
  /** The meal being re-logged — cloned for the optimistic card. */
  source: PersistedMeal;
  /** Client-generated id shared by the optimistic card and the persisted row. */
  newMealId: string;
  /** The day the duplicate lands on (= loggedDate). */
  originDate: string;
  loggedDate: string;
  timezoneOffset: number;
  /** Optimistic ISO timestamp; the server response overwrites it on success. */
  loggedAt: string;
}

/**
 * "Log again" — duplicate an existing meal server-side (deterministic copy of
 * its item rows, no AI re-analysis), reconciling the new meal into the day the
 * same way a confirm does. The optimistic card is a clone of the source meal
 * under the new id so it appears instantly.
 */
export function useDuplicateMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (v: DuplicateMealVariables) =>
      duplicateMealAction({
        mealId: v.source.id,
        newMealId: v.newMealId,
        loggedDate: v.loggedDate,
        timezoneOffset: v.timezoneOffset,
      }),
    onMutate: (v) =>
      applyOptimisticMeal(queryClient, userId, v.originDate, {
        ...v.source,
        id: v.newMealId,
        loggedAt: v.loggedAt,
        // A re-log is a brand-new meal, shared to circle by default — not a
        // carry-over of the source's share state. shareId is empty until the
        // save response brings the real one.
        share: { shareId: '', visibility: 'circle' },
      }),
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
      settleMealSave(queryClient, userId, v.originDate, error),
  });
}
