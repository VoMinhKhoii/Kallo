'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateMealAction } from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import {
  upsertById,
  upsertMealIntoList,
} from '@/lib/domain/meals/save/day-cache';

// Edit a persisted meal in place: gram overrides and/or per-row removals. The
// server recomputes nutrition and returns the authoritative saved meal, which
// overwrites the card by its stable id (no remount). Scoped to the user's day.
export function useUpdateMeal(userId: string, originDate: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMealAction,
    onMutate: async () => {
      // Cancel any day fetch still in flight BEFORE the edit lands: such a
      // fetch read the pre-edit snapshot and would overwrite the authoritative
      // onSuccess write when it resolves (mirrors useConfirmMeal's onMutate).
      await queryClient.cancelQueries({
        queryKey: loggingDayKeys.byUserDate(userId, originDate),
      });
    },
    onSuccess: (data) => {
      const savedMeal = data.meal;
      if (!savedMeal) return;
      const loggingDayKey = loggingDayKeys.byUserDate(userId, originDate);
      const dailyMealsKey = dailyMealsKeys.byDate(originDate);
      queryClient.setQueriesData<LoggingDayData>(
        { queryKey: loggingDayKey },
        (old) =>
          old
            ? {
                ...old,
                persistedMeals: upsertById(old.persistedMeals, savedMeal),
              }
            : old
      );
      queryClient.setQueriesData<PersistedMeal[]>(
        { queryKey: dailyMealsKey },
        (old) => upsertMealIntoList(old, savedMeal)
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Không thể cập nhật bữa ăn.'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, originDate),
        refetchType: 'none',
      });
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(originDate),
      });
      // The edit recomputed meals.calories_kcal, and the timeline sidebar's
      // per-day total reads off this cache. Without it the card shows the new
      // calories while the sidebar keeps the old ones until an unrelated
      // refetch. The save and delete paths already do this; an edit only
      // started mattering once the summaries carried totals as well as dates.
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
  });
}
