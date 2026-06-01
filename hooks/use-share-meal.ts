'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { circleFeedKeys } from '@/hooks/use-circle-feed';
import { dailyMealsKeys } from '@/hooks/use-daily-meals';
import { setMealShareVisibility } from '@/lib/groups/client';

interface ShareMealInput {
  mealId: string;
  visibility: 'private' | 'circle';
}

/**
 * Toggle a saved meal's circle visibility (post-save, per-meal opt-in).
 * Invalidates the circle feed so the wall reflects the change, and the day
 * meals so each card seeds its share toggle from fresh server state.
 */
export function useShareMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, visibility }: ShareMealInput) =>
      setMealShareVisibility(mealId, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
      queryClient.invalidateQueries({ queryKey: dailyMealsKeys.all });
    },
  });
}
