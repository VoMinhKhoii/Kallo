'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveManualMealAction } from '@/lib/actions/logging/manual-meals';
import { parseGrams, rowLabel } from '@/lib/domain/logging/manual-logging';
import {
  buildOptimisticManualMeal,
  type SaveManualMealVariables,
} from '@/lib/domain/meals/save/optimistic-manual-meal';
import {
  applyOptimisticMeal,
  reconcileSavedMeal,
  rollbackOptimisticMeal,
  settleMealSave,
} from '@/lib/domain/meals/save/save-choreography';

/**
 * Save a manually-composed meal (ingredient ids + grams — no AI, no pending
 * analysis). Cache choreography mirrors useConfirmMeal: optimistic upsert into
 * the logging-day prefix key, in-place authoritative overwrite on success,
 * snapshot rollback on error.
 *
 * `rows` are the complete form rows (ingredient picked + valid grams); the
 * optimistic meal is built from their client-held per-100g macros, then
 * overwritten in place by the server's authoritative meal (same id) on success.
 */
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
