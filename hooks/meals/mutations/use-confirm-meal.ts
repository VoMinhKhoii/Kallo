'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { relogCandidatesKeys } from '@/lib/domain/meals/query-keys';
import {
  buildOptimisticMeal,
  type ConfirmMealVariables,
} from '@/lib/domain/meals/save/optimistic-meal';
import {
  applyOptimisticMeal,
  reconcileSavedMeal,
  rollbackOptimisticMeal,
  settleMealSave,
} from '@/lib/domain/meals/save/save-choreography';

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
      // Extra keys: the "log it again" cheat chips (so a newly-saved cheat
      // occasion appears) and the relog picker candidates (a confirmed meal —
      // including a confirmed relog — gains an occurrence and re-ranks).
      settleMealSave(queryClient, userId, variables.originDate, error, [
        ['recent-cheat-occasions'],
        relogCandidatesKeys.all,
      ]),
  });
}
