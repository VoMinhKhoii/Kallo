import { useQuery } from '@tanstack/react-query';
import type { getOnboardingProfile } from '@/lib/api/contracts/onboarding';
import { apiGet } from '~/lib/api-client';
import { onboardingKeys } from '~/lib/onboarding/keys';

/** The full `userProfiles` row returned by GET /api/v1/onboarding/profile. */
export type ProfileRow = NonNullable<
  Awaited<ReturnType<typeof getOnboardingProfile>>
>;

/**
 * Loads the user's profile row (or null if onboarding never ran). Shares the
 * `['onboarding','profile']` cache key with the dashboard/logging screens.
 */
export function useProfile(enabled = true) {
  return useQuery<ProfileRow | null>({
    queryKey: onboardingKeys.profile,
    queryFn: () => apiGet<ProfileRow | null>('/api/v1/onboarding/profile'),
    staleTime: 60_000,
    enabled,
  });
}
