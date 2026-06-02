/**
 * React Query keys for the dashboard surface — replicated EXACTLY from the web
 * so the cache shape and prefix-matching behavior match. As with the logging
 * layer (`~/lib/logging/keys.ts`), invalidations rely on TanStack prefix
 * matching — NEVER add `exact: true`.
 *
 * Heatmap (web: components/dashboard/use-dashboard-queries.ts):
 *   query key   ['dashboard', 'heatmapData', range]  (3-element, by range)
 *   invalidate  ['dashboard', 'heatmapData']          (2-element prefix)
 * Note: the web key does NOT include the timezone offset — keep it out here too.
 *
 * Weight summary (web: hooks/use-weight-summary.ts):
 *   query key   ['weight-summary', range]   (2-element, by range; no tz)
 *   invalidate  ['weight-summary']          (1-element prefix → both ranges)
 */
import type { HeatmapRange } from '@/lib/types/dashboard';
import type { WeightRange } from '@/lib/types/weight';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  /** 3-element query key. Invalidate with the 2-element `heatmapAll` prefix. */
  heatmap: (range: HeatmapRange) =>
    ['dashboard', 'heatmapData', range] as const,
  /** 2-element prefix for invalidation (prefix-matches every range). */
  heatmapAll: ['dashboard', 'heatmapData'] as const,
};

export const weightSummaryKeys = {
  all: ['weight-summary'] as const,
  byRange: (range: WeightRange) => ['weight-summary', range] as const,
};

/**
 * Per-date weight cache axis. The summary chart is the only weight reader on
 * mobile today, but mutations key invalidations on the broad
 * `weightSummaryKeys.all` prefix (matches the web's onSuccess invalidation).
 * Exposed for parity with the logging layer's date-scoped keys if a per-date
 * weight reader is added later.
 */
export const weightByDateKeys = {
  all: ['weight'] as const,
  byDate: (loggedDate: string) => ['weight', loggedDate] as const,
};
