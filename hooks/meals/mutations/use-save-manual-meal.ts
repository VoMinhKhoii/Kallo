'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveManualMealAction } from '@/lib/actions/logging/manual-meals';
import { itemLabel } from '@/lib/domain/logging/manual-logging';
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
 * `items` are the meal's foods at their grams; the optimistic meal is built
 * from their client-held per-100g macros, then overwritten in place by the
 * server's authoritative meal (same id) on success. `name` arrives trimmed,
 * and absent when blank (`useManualSave`).
 */
export function useSaveManualMeal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SaveManualMealVariables) =>
      saveManualMealAction({
        mealId: variables.mealId,
        name: variables.name,
        items: variables.items.map((item) => ({
          foodCompositionId: item.ingredient.id,
          grams: item.grams,
          // Persist the user's raw text (else the food's name) as the label.
          label: itemLabel(item),
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
