import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoggingDayData } from '@/lib/api/contracts/meals';
import type { MealQuantityEdit } from '@/lib/types/meal';
import { apiDelete, apiPost } from '~/lib/api-client';
import { loggingDayKeys } from '~/lib/logging/keys';

interface ConfirmMealInput {
  analysisId: string;
  mealId: string;
  originDate: string; // client-only cache-keying axis; not sent to the server
  edits?: MealQuantityEdit[];
}

/**
 * Confirm a pending analysis into a saved meal. Optimistically removes the
 * pending row from the day cache (the persisted meal appears on refetch via
 * onSettled invalidation), keyed on `loggingDayKeys.byUserDate(userId,
 * originDate)` which prefix-matches the 4-element fetch key.
 */
export function useConfirmMeal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ originDate: _originDate, ...input }: ConfirmMealInput) =>
      apiPost('/api/v1/meals/confirm', input),
    onMutate: async ({ analysisId, originDate }) => {
      const filter = { queryKey: loggingDayKeys.byUserDate(userId, originDate) };
      await queryClient.cancelQueries(filter);
      const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
      queryClient.setQueriesData<LoggingDayData>(filter, (old) =>
        old
          ? {
              ...old,
              pendingConfirmations: old.pendingConfirmations.filter(
                (p) => p.id !== analysisId
              ),
            }
          : old
      );
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      console.error('[logging] confirm meal failed', error);
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: (_data, _error, { originDate }) => {
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, originDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
  });
}

interface DeleteMealInput {
  mealId: string;
  originDate: string; // the day the meal belongs to
}

/**
 * Corrected delete (the web hook was dead/buggy — keyed on the wrong cache and
 * hardcoded today). Optimistically removes the meal from the day's
 * persistedMeals, keyed on loggingDayKeys.byUserDate(userId, originDate).
 */
export function useDeleteMeal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId }: DeleteMealInput) =>
      apiDelete(`/api/v1/meals/${mealId}`),
    onMutate: async ({ mealId, originDate }) => {
      const filter = { queryKey: loggingDayKeys.byUserDate(userId, originDate) };
      await queryClient.cancelQueries(filter);
      const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
      queryClient.setQueriesData<LoggingDayData>(filter, (old) =>
        old
          ? {
              ...old,
              persistedMeals: old.persistedMeals.filter((m) => m.id !== mealId),
            }
          : old
      );
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      console.error('[logging] delete meal failed', error);
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: (_data, _error, { originDate }) => {
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, originDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    },
  });
}
