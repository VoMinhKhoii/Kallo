import { useQuery } from '@tanstack/react-query';
import type { HeatmapData } from '@/lib/api/contracts/dashboard';
import type { HeatmapRange } from '@/lib/types/dashboard';
import { apiGet } from '~/lib/api-client';
import { dashboardKeys } from './keys';

/**
 * Loads the server-built adherence heatmap from the REST surface. The grid
 * (cells, colors layout, month headers) is computed server-side
 * (`loadCalorieAdherenceHeatmap`); mobile only renders it.
 *
 * Mirrors the web `useDashboardQueries` heatmap query: 3-element key by range,
 * `timezoneOffset` derived with standard JS (matches both web's queryFn and
 * mobile `useLoggingDay`) and sent as `&tz=`. Send the SAME range string that
 * will be rendered so the server returns the matching grid.
 *
 * Mobile renders a FIXED 90-day window (`'90d'`) — the same range the web
 * resolves to at a phone's available width — so the default arg is `'90d'`.
 *
 * Invalidate on app focus / day rollover with the 2-element prefix
 * `dashboardKeys.heatmapAll` (no `exact: true`). Meal mutations do NOT touch
 * this cache (web relies on the 60s staleTime + focus refetch instead).
 */
export function useHeatmap(range: HeatmapRange = '90d') {
  const timezoneOffset = new Date().getTimezoneOffset();
  return useQuery<HeatmapData>({
    queryKey: dashboardKeys.heatmap(range),
    queryFn: () =>
      apiGet<HeatmapData>(
        `/api/v1/dashboard/heatmap?range=${range}&tz=${timezoneOffset}`
      ),
    staleTime: 60_000,
  });
}
