import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '~/lib/api-client';
import { onboardingKeys } from '../keys';

/**
 * Saves one onboarding step via POST /api/v1/onboarding/screen (mirrors the web
 * `saveOnboardingScreen`). Skip = `data: {}` (advances onboardingStep without
 * writing fields). On settle, invalidates the profile cache (refreshes targets
 * across dashboard/logging) and the heatmap (targets gate adherence).
 */
export function useSaveScreen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      step,
      data,
    }: {
      step: number;
      data: Record<string, unknown>;
    }) => apiPost<{ success: true }>('/api/v1/onboarding/screen', { step, data }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKeys.profile });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'heatmapData'],
      });
    },
  });
}
