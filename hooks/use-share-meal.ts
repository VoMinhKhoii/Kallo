'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setMealShareVisibility } from '@/lib/groups/client';
import { circleFeedKeys } from '@/hooks/use-circle-feed';

interface ShareMealInput {
  mealId: string;
  visibility: 'private' | 'circle';
}

/**
 * Toggle a saved meal's circle visibility (post-save, per-meal opt-in).
 * Invalidates the circle feed so the wall reflects the change on next read.
 */
export function useShareMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, visibility }: ShareMealInput) =>
      setMealShareVisibility(mealId, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}
