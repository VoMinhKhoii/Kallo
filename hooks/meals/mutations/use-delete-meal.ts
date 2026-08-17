'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteMealAction } from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';

// Delete a meal, scoped by (userId, originDate) — mirrors useUpdateMeal. The
// optimistic drop and the settle invalidation both touch the logging-day cache
// AND the dashboard daily-meals cache, so neither ring keeps showing the
// removed meal. Scoping by the passed originDate (not a self-computed "today")
// keeps a quick-save-then-undo correct across a midnight rollover.
export function useDeleteMeal(userId: string, originDate: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealAction,
    onMutate: async ({ mealId }) => {
      // Cancel any in-flight day fetch first: it read the pre-delete snapshot
      // and would restore the meal when it lands (mirrors useUpdateMeal).
      const loggingDayFilter = {
        queryKey: loggingDayKeys.byUserDate(userId, originDate),
      };
      const dailyMealsKey = dailyMealsKeys.byDate(originDate);
      await Promise.all([
        queryClient.cancelQueries(loggingDayFilter),
        queryClient.cancelQueries({ queryKey: dailyMealsKey }),
      ]);
      const loggingDaySnapshots =
        queryClient.getQueriesData<LoggingDayData>(loggingDayFilter);
      const dailyMeals =
        queryClient.getQueryData<PersistedMeal[]>(dailyMealsKey);

      queryClient.setQueriesData<LoggingDayData>(loggingDayFilter, (old) =>
        old
          ? {
              ...old,
              persistedMeals: old.persistedMeals.filter(
                (meal) => meal.id !== mealId
              ),
            }
          : old
      );
      if (dailyMeals) {
        queryClient.setQueryData<PersistedMeal[]>(
          dailyMealsKey,
          dailyMeals.filter((meal) => meal.id !== mealId)
        );
      }

      return { loggingDaySnapshots, dailyMeals, dailyMealsKey };
    },
    onError: (error, _vars, context) => {
      // Rollback both caches on failure.
      if (context?.loggingDaySnapshots) {
        for (const [key, data] of context.loggingDaySnapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.dailyMeals) {
        queryClient.setQueryData(context.dailyMealsKey, context.dailyMeals);
      }
      toast.error(
        error instanceof Error ? error.message : 'Không thể xóa bữa ăn.'
      );
    },
    onSettled: (_data, error) => {
      // On success the optimistic delete already healed the mounted surface, so
      // just mark stale (no refetch). On failure the rollback can only restore
      // the pre-cancel snapshot (undefined if an initial load was cancelled
      // mid-flight), so refetch actively to heal — mirrors settleMealSave.
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, originDate),
        refetchType: error ? 'active' : 'none',
      });
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(originDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
  });
}
