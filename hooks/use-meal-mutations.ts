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
import { recalculateTotals } from '@/lib/meal-utils';
import type { MacroBreakdown, MealItem } from '@/lib/types/meal';

type QuantityEdit = NonNullable<
  Parameters<typeof confirmAndSaveMealAction>[0]['edits']
>[number];

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

// Apply dish-level quantity edits so the optimistic card shows the user's
// adjusted values immediately, instead of the original AI estimate until the
// refetch lands. Per-ingredient edits are left to the server-backed refetch.
function applyEditsToItems(
  items: MealItem[],
  edits: QuantityEdit[] | undefined
): MealItem[] {
  const newGramsByOrder = new Map<number, number>();
  for (const edit of edits ?? []) {
    if (edit.ingredientIndex === undefined) {
      newGramsByOrder.set(edit.mealItemOrder, edit.newGrams);
    }
  }
  if (newGramsByOrder.size === 0) return items;

  return items.map((item, order) => {
    const newGrams = newGramsByOrder.get(order);
    if (newGrams === undefined || item.quantity <= 0) return item;
    const ratio = newGrams / item.quantity;
    return {
      ...item,
      quantity: newGrams,
      macros: {
        calories: item.macros.calories * ratio,
        protein: item.macros.protein * ratio,
        carbs: item.macros.carbs * ratio,
        fat: item.macros.fat * ratio,
      },
    };
  });
}

function pendingToOptimisticMeal(
  pending: PendingMealConfirmation,
  edits?: QuantityEdit[]
): PersistedMeal {
  const items = applyEditsToItems(pending.parsedMeal.items, edits);
  const groups: PersistedMealItemGroup[] = items.map((item, order) => ({
    name: item.name,
    order,
    ingredients: [],
    nutrition: macrosToNutrition(item.macros),
  }));
  const total = edits?.length
    ? recalculateTotals(items)
    : pending.parsedMeal.totalMacros;
  return {
    id: `optimistic-${pending.id}`,
    rawInput: pending.rawInput,
    mealSlot: null,
    confidenceOverall: null,
    loggedAt: pending.loggedAt,
    nutrition: macrosToNutrition(total),
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
            pendingToOptimisticMeal(pending, variables.edits),
          ],
          pendingConfirmations: old.pendingConfirmations.filter(
            (p) => p.id !== variables.analysisId
          ),
        };
      });
      return { snapshots };
    },
    onSuccess: (data, variables) => {
      // Swap the optimistic id for the real meal id so the refetch triggered
      // in onSettled reuses the same React key. Without this the card unmounts
      // and remounts, replaying its fade-in animation right after saving.
      queryClient.setQueriesData<LoggingDayData>(
        { queryKey: loggingDayKeys.byUserDate(userId, variables.originDate) },
        (old) => {
          if (!old) return old;
          const optimisticId = `optimistic-${variables.analysisId}`;
          return {
            ...old,
            persistedMeals: old.persistedMeals.map((meal) =>
              meal.id === optimisticId ? { ...meal, id: data.mealId } : meal
            ),
          };
        }
      );
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
