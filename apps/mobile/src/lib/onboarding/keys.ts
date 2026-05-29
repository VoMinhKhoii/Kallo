/**
 * React Query keys for the onboarding/profile surface. The profile read shares
 * the SAME key the dashboard/logging screens already use (`['onboarding',
 * 'profile']`) so a settings save invalidates every reader. Invalidations rely
 * on prefix matching — NEVER add `exact: true`.
 */
export const onboardingKeys = {
  all: ['onboarding'] as const,
  profile: ['onboarding', 'profile'] as const,
};
