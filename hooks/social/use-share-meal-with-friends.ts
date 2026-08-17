'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import { circleFeedKeys } from '@/hooks/social/use-circle-feed';
import { shareMealWithFriends } from '@/lib/social/circle-client';

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
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}
