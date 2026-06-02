import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfileSettingsInput } from '@/lib/api/contracts/onboarding';
import { apiPut } from '~/lib/api-client';
import { onboardingKeys } from '~/lib/onboarding/keys';

/**
 * Saves the profile/settings form via PUT /api/v1/profile (mirrors the web
 * settings form's `saveProfileSettings`). Invalidates the shared profile cache
 * on settle so the dashboard/logging targets refresh.
 */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileSettingsInput) =>
      apiPut<{ success: true }>('/api/v1/profile', payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKeys.profile });
    },
  });
}
