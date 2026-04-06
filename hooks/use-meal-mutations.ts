'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyMealsKeys } from '@/hooks/use-daily-meals';
import type { PersistedMeal } from '@/lib/actions/meals';
import {
  confirmAndSaveMealAction,
  deleteMealAction,
} from '@/lib/actions/meals';

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useConfirmMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmAndSaveMealAction,
    onSuccess: () => {
      // Invalidate today's meals to refetch from DB
      const today = todayDateString();
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(today),
      });
      // Also invalidate the meal dates list for timeline
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Không thể lưu bữa ăn.'
      );
    },
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealAction,
    onMutate: async ({ mealId }) => {
      // Optimistic delete: remove meal from cache before server confirms
      const today = todayDateString();
      const queryKey = dailyMealsKeys.byDate(today);

      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PersistedMeal[]>(queryKey);

      if (previous) {
        queryClient.setQueryData<PersistedMeal[]>(
          queryKey,
          previous.filter((m) => m.id !== mealId)
        );
      }

      return { previous, queryKey };
    },
    onError: (error, _vars, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error(
        error instanceof Error ? error.message : 'Không thể xóa bữa ăn.'
      );
    },
    onSettled: () => {
      const today = todayDateString();
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(today),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
  });
}
