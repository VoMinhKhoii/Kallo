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
import { recalculateTotals } from '@/lib/meal-utils';
import type { MacroBreakdown, MealItem, ParsedMeal } from '@/lib/types/meal';

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
  edits?: QuantityEdit[]
): PersistedMeal {
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
    // A freshly-saved meal is never shared yet.
    share: null,
  };
}

// Replace the list item whose id matches `meal.id`, or append it if absent.
function upsertById(
  list: PersistedMeal[],
  meal: PersistedMeal
): PersistedMeal[] {
  return list.some((m) => m.id === meal.id)
    ? list.map((m) => (m.id === meal.id ? meal : m))
    : [...list, meal];
}

// Put the confirmed meal into a cached logging-day, idempotently: replace the
// row sharing its stable id (the optimistic insert) with this one, or append it
// if absent, and drop the matching pending confirmation. Shared by onMutate (the
// optimistic estimate) and onSuccess (the authoritative server meal from the
// confirm response, which overwrites the estimate in place — same id, so no
// remount/re-fade — and is the reason no day refetch is needed to reconcile).
function mergeConfirmedMealIntoDay(
  old: LoggingDayData | undefined,
  meal: PersistedMeal,
  analysisId: string
): LoggingDayData {
  if (!old) {
    // Entry exists but its initial load is still in flight (data undefined).
    // Seed it so the ring reflects this meal immediately. Note: setQueriesData
    // only runs this updater for already-cached query entries; it cannot create
    // one where the query is unmounted.
    return { persistedMeals: [meal], pendingConfirmations: [] };
  }
  return {
    persistedMeals: upsertById(old.persistedMeals, meal),
    pendingConfirmations: old.pendingConfirmations.filter(
      (p) => p.id !== analysisId
    ),
  };
}

// Upsert a meal into the dashboard's daily-meals list (a bare PersistedMeal[]).
// Returns `old` untouched when the query isn't cached, so we never fabricate a
// list for a dashboard that was never mounted (it should refetch on next mount).
function upsertMealIntoList(
  old: PersistedMeal[] | undefined,
  meal: PersistedMeal
): PersistedMeal[] | undefined {
  if (!old) return old;
  return upsertById(old, meal);
}

// Client-supplied data needed to build the optimistic meal without reading the
// pending confirmation back out of the cache. Stripped before the server call.
// `mealId` is REQUIRED here (the server schema keeps it optional for the mobile
// REST route): the optimistic insert and the authoritative onSuccess write must
// share one id, otherwise they'd be two rows and the ring would double-count.
type ConfirmMealVariables = Omit<
  Parameters<typeof confirmAndSaveMealAction>[0],
  'mealId'
> & {
  mealId: string;
  originDate: string;
  parsedMeal: ParsedMeal;
  rawInput: string;
  loggedAt: string;
};

export function useConfirmMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      originDate: _originDate,
      parsedMeal: _parsedMeal,
      rawInput: _rawInput,
      loggedAt: _loggedAt,
      ...input
    }: ConfirmMealVariables) => confirmAndSaveMealAction(input),
    onMutate: async (variables) => {
      const filter = {
        queryKey: loggingDayKeys.byUserDate(userId, variables.originDate),
      };
      await queryClient.cancelQueries(filter);
      const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
      const optimisticMeal = buildOptimisticMeal(
        variables.parsedMeal,
        variables.rawInput,
        variables.loggedAt,
        variables.mealId,
        variables.edits
      );
      queryClient.setQueriesData<LoggingDayData>(filter, (old) =>
        mergeConfirmedMealIntoDay(old, optimisticMeal, variables.analysisId)
      );
      return { snapshots };
    },
    onSuccess: (data, variables) => {
      const loggingDayKey = loggingDayKeys.byUserDate(
        userId,
        variables.originDate
      );
      const dailyMealsKey = dailyMealsKeys.byDate(variables.originDate);
      // Cancel any day fetch still in flight BEFORE writing authoritative state:
      // such a fetch read the PRE-save (empty/pending) snapshot and would clobber
      // this write when it lands. Cancelling first means its late result is
      // discarded, closing the window between this write and the settle phase.
      queryClient.cancelQueries({ queryKey: loggingDayKey });
      queryClient.cancelQueries({ queryKey: dailyMealsKey });
      // Reconcile straight from the confirm response — the server returns the
      // saved meal in its authoritative (goal-adjusted) shape, so we overwrite
      // the optimistic estimate in place rather than waiting for a day refetch.
      // This removes the brief "estimate then correct" flash on the calorie ring
      // and saves the follow-up network round-trip.
      const savedMeal = data.meal;
      if (!savedMeal) {
        // Defensive (the web action always returns `meal`): if a version-skewed
        // response omits it, fall back to a refetch so the ring reconciles
        // instead of keeping the optimistic estimate stuck.
        queryClient.invalidateQueries({ queryKey: loggingDayKey });
        queryClient.invalidateQueries({ queryKey: dailyMealsKey });
        return;
      }
      queryClient.setQueriesData<LoggingDayData>(
        { queryKey: loggingDayKey },
        (old) => mergeConfirmedMealIntoDay(old, savedMeal, variables.analysisId)
      );
      // Keep the dashboard ring in sync instantly when its daily-meals query is
      // already mounted; an unmounted one is marked stale by the invalidate on
      // settle and refetches on its next mount.
      queryClient.setQueriesData<PersistedMeal[]>(
        { queryKey: dailyMealsKey },
        (old) => upsertMealIntoList(old, savedMeal)
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
    onSettled: (_data, error, variables) => {
      const loggingDayKey = loggingDayKeys.byUserDate(
        userId,
        variables.originDate
      );
      const dailyMealsKey = dailyMealsKeys.byDate(variables.originDate);
      // On success, onSuccess already wrote authoritative state from the confirm
      // response, so just mark the day queries stale WITHOUT a refetch
      // (refetchType 'none' = no network) — an unmounted surface (e.g. the
      // dashboard while logging) refreshes on its next mount. On error the
      // optimistic insert was rolled back; refetch actively to heal in case a
      // cancelled in-flight fetch left a surface behind.
      const refetchType = error ? 'active' : 'none';
      queryClient.invalidateQueries({ queryKey: loggingDayKey, refetchType });
      queryClient.invalidateQueries({ queryKey: dailyMealsKey, refetchType });
      // meal-dates (timeline dots) has no optimistic path; refresh it normally.
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
