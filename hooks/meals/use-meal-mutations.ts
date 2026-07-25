'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyMealsKeys } from '@/hooks/meals/use-daily-meals';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import { saveManualMealAction } from '@/lib/actions/manual-meals';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { duplicateMealAction } from '@/lib/actions/meals/duplicate-meal';
import {
  deleteMealAction,
  updateMealAction,
} from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { parseGrams, rowLabel } from '@/lib/logging/manual-logging';
import {
  buildOptimisticManualMeal,
  buildOptimisticMeal,
  type ConfirmMealVariables,
  type SaveManualMealVariables,
  upsertById,
  upsertMealIntoList,
} from './meal-mutation-helpers';
import {
  applyOptimisticMeal,
  reconcileSavedMeal,
  rollbackOptimisticMeal,
  settleMealSave,
} from './meal-save-choreography';

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
    onMutate: (variables) =>
      applyOptimisticMeal(
        queryClient,
        userId,
        variables.originDate,
        buildOptimisticMeal(
          variables.parsedMeal,
          variables.rawInput,
          variables.loggedAt,
          variables.mealId,
          variables.edits,
          variables.cheat
        ),
        variables.analysisId
      ),
    onSuccess: (data, variables, context) =>
      reconcileSavedMeal(
        queryClient,
        userId,
        variables.originDate,
        data.meal,
        variables.analysisId,
        context?.snapshots,
        context?.dayFetchCancelled
      ),
    onError: (error, _vars, context) =>
      rollbackOptimisticMeal(queryClient, error, context),
    onSettled: (_data, error, variables) =>
      // The extra key refreshes the "log it again" chips so a newly-saved
      // cheat occasion appears.
      settleMealSave(queryClient, userId, variables.originDate, error, [
        ['recent-cheat-occasions'],
      ]),
  });
}

// Client-supplied data for a manual (Cronometer-style) save. `rows` are the
// complete form rows (ingredient picked + valid grams); the optimistic meal is
// built from their client-held per-100g macros, then overwritten in place by
// the server's authoritative meal (same id) on success.

export function useSaveManualMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SaveManualMealVariables) =>
      saveManualMealAction({
        mealId: variables.mealId,
        items: variables.rows.map((row) => ({
          foodCompositionId: row.ingredient.id,
          // rowIsComplete guaranteed a parseable positive value.
          grams: parseGrams(row.grams) ?? 0,
          // Persist the user's raw text as the label.
          label: rowLabel(row),
        })),
        mealSlot: variables.mealSlot,
        loggedDate: variables.loggedDate,
        timezoneOffset: variables.timezoneOffset,
      }),
    onMutate: (variables) =>
      applyOptimisticMeal(
        queryClient,
        userId,
        variables.originDate,
        buildOptimisticManualMeal(variables)
      ),
    onSuccess: (data, variables, context) =>
      reconcileSavedMeal(
        queryClient,
        userId,
        variables.originDate,
        data.meal,
        undefined,
        context?.snapshots,
        context?.dayFetchCancelled
      ),
    onError: (error, _vars, context) =>
      rollbackOptimisticMeal(queryClient, error, context),
    onSettled: (_data, error, variables) =>
      settleMealSave(queryClient, userId, variables.originDate, error),
  });
}

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
    },
  });
}

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
