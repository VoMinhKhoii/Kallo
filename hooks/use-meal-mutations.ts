'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyMealsKeys } from '@/hooks/use-daily-meals';
import { loggingDayKeys } from '@/hooks/use-logging-day';
import type {
  LoggingDayData,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals';
import {
  confirmAndSaveMealAction,
  deleteMealAction,
} from '@/lib/actions/meals';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { NutritionValues } from '@/lib/ai/types';
import { resolveSliderNutrition } from '@/lib/cheat/slider-nutrition';
import { recalculateTotals } from '@/lib/meal-utils';
import type {
  CheatSliderLevels,
  CheatSliderSpec,
} from '@/lib/types/cheat';
import type { MacroBreakdown, MealItem, ParsedMeal } from '@/lib/types/meal';

/** Client-held cheat data needed to seed the optimistic cheat-meal card. */
interface OptimisticCheatInput {
  spec: CheatSliderSpec;
  levels: CheatSliderLevels;
}

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

// Build the optimistic persisted meal from data the caller already holds (the
// streamed analysis result), rather than re-reading the pending confirmation
// from the query cache. The cached pending row may not have landed yet when the
// user confirms (esp. the first meal of the day), so depending on it caused the
// optimistic update to silently no-op and the calorie ring to stay stale.
function buildOptimisticMeal(
  parsedMeal: ParsedMeal,
  rawInput: string,
  loggedAt: string,
  mealId: string,
  edits?: QuantityEdit[],
  cheat?: OptimisticCheatInput
): PersistedMeal {
  // Cheat meal: resolve nutrition from the chosen slider levels (same helper
  // the server uses), and carry the spec/levels so the card renders the cheat
  // variant immediately.
  if (cheat) {
    const resolved = resolveSliderNutrition(cheat.spec, cheat.levels);
    return {
      id: mealId,
      rawInput,
      mealSlot: cheat.spec.mealSlot,
      confidenceOverall: cheat.spec.confidence,
      loggedAt,
      nutrition: macrosToNutrition({
        calories: resolved.caloriesKcal,
        protein: resolved.proteinG,
        carbs: resolved.carbohydrateG,
        fat: resolved.fatG,
      }),
      mealItemGroups: [],
      entryMode: 'cheat',
      alcoholG: resolved.alcoholG,
      cheatSliders: { spec: cheat.spec, levels: cheat.levels },
      estimateRationale: cheat.spec.rationale,
    };
  }

  const items = applyEditsToItems(parsedMeal.items, edits);
  const groups: PersistedMealItemGroup[] = items.map((item, order) => ({
    name: item.name,
    order,
    ingredients: [],
    nutrition: macrosToNutrition(item.macros),
  }));
  const total = edits?.length
    ? recalculateTotals(items)
    : parsedMeal.totalMacros;
  return {
    // Same id the server will persist, so the card keeps one stable React key
    // from optimistic insert through the post-save refetch (no re-fade).
    id: mealId,
    rawInput,
    mealSlot: null,
    confidenceOverall: null,
    loggedAt,
    nutrition: macrosToNutrition(total),
    mealItemGroups: groups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    estimateRationale: null,
  };
}

// Client-supplied data needed to build the optimistic meal without reading the
// pending confirmation back out of the cache. Stripped before the server call.
type ConfirmMealVariables = Parameters<typeof confirmAndSaveMealAction>[0] & {
  originDate: string;
  parsedMeal: ParsedMeal;
  rawInput: string;
  loggedAt: string;
  /** Present for cheat meals — seeds the optimistic cheat card. */
  cheat?: OptimisticCheatInput;
};

export function useConfirmMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      originDate: _originDate,
      parsedMeal: _parsedMeal,
      rawInput: _rawInput,
      loggedAt: _loggedAt,
      cheat: _cheat,
      ...input
    }: ConfirmMealVariables) => confirmAndSaveMealAction(input),
    onMutate: async (variables) => {
      const filter = {
        queryKey: loggingDayKeys.byUserDate(userId, variables.originDate),
      };
      await queryClient.cancelQueries(filter);
      const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
      const mealId = variables.mealId ?? `optimistic-${variables.analysisId}`;
      const optimisticMeal = buildOptimisticMeal(
        variables.parsedMeal,
        variables.rawInput,
        variables.loggedAt,
        mealId,
        variables.edits,
        variables.cheat
      );
      queryClient.setQueriesData<LoggingDayData>(filter, (old) => {
        if (!old) {
          // Entry exists but its initial load is still in flight (data
          // undefined). Seed it so the ring reflects this meal immediately.
          // Note: setQueriesData only runs this updater for already-cached
          // query entries; it cannot create one where the query is unmounted.
          // The real fix for the stale ring is sourcing the meal from the
          // passed parsedMeal (above), not this branch.
          return { persistedMeals: [optimisticMeal], pendingConfirmations: [] };
        }
        // Guard against a double-insert if the settle refetch already raced in
        // this meal by its stable id.
        const alreadyPersisted = old.persistedMeals.some(
          (m) => m.id === mealId
        );
        return {
          persistedMeals: alreadyPersisted
            ? old.persistedMeals
            : [...old.persistedMeals, optimisticMeal],
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
