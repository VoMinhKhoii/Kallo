'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { weightSummaryKeys } from '@/hooks/use-weight-summary';
import { deleteWeightLogAction, logWeightAction } from '@/lib/actions/weight';

export function useLogWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logWeightAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: weightSummaryKeys.all });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Không thể lưu cân nặng.'
      );
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
