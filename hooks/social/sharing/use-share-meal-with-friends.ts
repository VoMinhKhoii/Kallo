'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import {
  shareMealWithFriends,
  undoMealShare,
} from '@/lib/domain/social/circle-client';
import { circleFeedKeys } from '@/lib/domain/social/query-keys';

/**
 * Offer a saved meal to specific friends as a full copy or a split. A split
 * rescales the logger's own meal down to their share, so the logging day is
 * invalidated to reflect the reduced portion (the feed reads loggingDayKeys,
 * not dailyMealsKeys — that latter feeds only the dashboard); the wall too.
 */
export function useShareMealWithFriends() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shareMealWithFriends,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loggingDayKeys.all });
      // The dashboard reads its ring off a separate cache; without this the
      // calorie ring keeps the pre-split total until it goes stale on its own.
      queryClient.invalidateQueries({ queryKey: dailyMealsKeys.all });
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}

/**
 * Undo a split. Invalidates exactly what the share did — an undo has to put
 * every surface the share touched back, not just the one in front of the user.
 */
export function useUndoMealShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: undoMealShare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loggingDayKeys.all });
      queryClient.invalidateQueries({ queryKey: dailyMealsKeys.all });
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}
