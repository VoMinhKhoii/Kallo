'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { weightSummaryKeys } from '@/hooks/weight/use-weight-summary';
import { deleteWeightLogAction, logWeightAction } from '@/lib/actions/weight';
import type { WeightSummaryData } from '@/lib/types/weight';
import type { WeightLogInput } from '@/lib/validation/weight';

type WeightSummarySnapshot = Array<
  [readonly unknown[], WeightSummaryData | undefined]
>;

function applyOptimisticWeight(
  prev: WeightSummaryData | undefined,
  weightKg: number
): WeightSummaryData | undefined {
  if (!prev) return prev;
  const weights = [...prev.weights];
  if (prev.todayWeight == null) {
    // No entry for today yet — extend the series with the new point.
    weights.push(weightKg);
  } else if (weights.length > 0) {
    // Updating today's weight — replace the most recent point in place.
    weights[weights.length - 1] = weightKg;
  } else {
    weights.push(weightKg);
  }
  return {
    ...prev,
    weights,
    currentWeight: weightKg,
    todayWeight: weightKg,
  };
}

export function useLogWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logWeightAction,
    // Optimistically move the chart so saving feels instant instead of reloading.
    onMutate: async (variables: WeightLogInput) => {
      await queryClient.cancelQueries({ queryKey: weightSummaryKeys.all });
      const snapshot = queryClient.getQueriesData<WeightSummaryData>({
        queryKey: weightSummaryKeys.all,
      }) as WeightSummarySnapshot;
      queryClient.setQueriesData<WeightSummaryData>(
        { queryKey: weightSummaryKeys.all },
        (prev) => applyOptimisticWeight(prev, variables.weightKg)
      );
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(
        error instanceof Error ? error.message : 'Không thể lưu cân nặng.'
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: weightSummaryKeys.all });
    },
  });
}

export function useDeleteWeightLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWeightLogAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: weightSummaryKeys.all });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Không thể xoá cân nặng.'
      );
    },
  });
}
