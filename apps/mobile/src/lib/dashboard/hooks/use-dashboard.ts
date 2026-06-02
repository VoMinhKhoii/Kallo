import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardBundle } from '@/lib/api/contracts/dashboard';
import { apiGet } from '~/lib/api-client';
import { loggingDayKeys } from '~/lib/logging/keys';
import { onboardingKeys } from '~/lib/onboarding/keys';
import { dashboardKeys, weightSummaryKeys } from '~/lib/dashboard/keys';

/**
 * Fetches the whole dashboard in ONE request (`GET /api/v1/dashboard`) instead
 * of letting TodaySection / WeightChart / AdherenceHeatmap / the profile query
 * each fire their own call. After the fetch it SEEDS each section's cache with
 * the matching slice, using the exact same query keys those hooks read:
 *
 *   - `loggingDayKeys.byUserDateOffset(userId, date, tz)`  → useLoggingDay
 *   - `weightSummaryKeys.byRange('30d')`                   → useWeightSummary (WeightChart)
 *   - `dashboardKeys.heatmap('90d')`                       → useHeatmap (AdherenceHeatmap)
 *   - `onboardingKeys.profile`                             → profile / OnboardingGate
 *
 * The dashboard screen gates its sections on THIS query, so by the time those
 * hooks mount the cache is warm and fresh (within each hook's staleTime) — they
 * resolve from cache without a second round-trip. If a section later goes stale
 * (focus refetch, day rollover) it falls back to its own standalone route.
 *
 * `tz` is derived the same way the section hooks derive it
 * (`new Date().getTimezoneOffset()`) so the seeded logging-day key matches.
 */
export function useDashboard(userId: string, date: string, enabled = true) {
  const queryClient = useQueryClient();
  const timezoneOffset = new Date().getTimezoneOffset();

  return useQuery<DashboardBundle>({
    enabled: enabled && !!userId,
    queryKey: ['dashboard-bundle', userId, date, timezoneOffset],
    queryFn: async () => {
      const bundle = await apiGet<DashboardBundle>(
        `/api/v1/dashboard?date=${encodeURIComponent(date)}&tz=${timezoneOffset}`
      );
      queryClient.setQueryData(
        loggingDayKeys.byUserDateOffset(userId, date, timezoneOffset),
        bundle.day
      );
      queryClient.setQueryData(
        weightSummaryKeys.byRange('30d'),
        bundle.weightSummary
      );
      queryClient.setQueryData(dashboardKeys.heatmap('90d'), bundle.heatmap);
      queryClient.setQueryData(onboardingKeys.profile, bundle.profile);
      return bundle;
    },
    staleTime: 30_000,
  });
}
