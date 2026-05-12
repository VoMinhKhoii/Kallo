'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyMealsKeys } from '@/hooks/use-daily-meals';
import { loggingDayKeys } from '@/hooks/use-logging-day';
import type {
  LoggingDayData,
  PendingMealConfirmation,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals';
import {
  confirmAndSaveMealAction,
  deleteMealAction,
} from '@/lib/actions/meals';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { NutritionValues } from '@/lib/ai/types';
import type { MacroBreakdown } from '@/lib/types/meal';

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const EMPTY_NUTRITION = Object.fromEntries(
  NUTRITION_KEYS.map((key) => [key, null])
) as unknown as NutritionValues;

function macrosToNutrition(macros: MacroBreakdown): NutritionValues {
  return {
    ...EMPTY_NUTRITION,
    caloriesKcal: macros.calories,
    proteinG: macros.protein,
    carbohydrateG: macros.carbs,
    fatG: macros.fat,
  };
}

function pendingToOptimisticMeal(
  pending: PendingMealConfirmation
): PersistedMeal {
  const groups: PersistedMealItemGroup[] = pending.parsedMeal.items.map(
    (item, order) => ({
      name: item.name,
      order,
      ingredients: [],
      nutrition: macrosToNutrition(item.macros),
    })
  );
  return {
    id: `optimistic-${pending.id}`,
    rawInput: pending.rawInput,
    mealSlot: null,
    confidenceOverall: null,
    loggedAt: pending.loggedAt,
    nutrition: macrosToNutrition(pending.parsedMeal.totalMacros),
    mealItemGroups: groups,
  };
}

export function useConfirmMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      originDate: _originDate,
      ...input
    }: Parameters<typeof confirmAndSaveMealAction>[0] & {
      originDate: string;
    }) => confirmAndSaveMealAction(input),
    onMutate: async (variables) => {
      const filter = {
        queryKey: loggingDayKeys.byUserDate(userId, variables.originDate),
      };
      await queryClient.cancelQueries(filter);
      const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
      queryClient.setQueriesData<LoggingDayData>(filter, (old) => {
        if (!old) return old;
        const pending = old.pendingConfirmations.find(
          (p) => p.id === variables.analysisId
        );
        if (!pending) return old;
        return {
          persistedMeals: [
            ...old.persistedMeals,
            pendingToOptimisticMeal(pending),
          ],
          pendingConfirmations: old.pendingConfirmations.filter(
            (p) => p.id !== variables.analysisId
          ),
        };
      });
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(
        error instanceof Error ? error.message : 'Không thể lưu bữa ăn.'
      );
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: dailyMealsKeys.byDate(variables.originDate),
      });
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, variables.originDate),
      });
      queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
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
