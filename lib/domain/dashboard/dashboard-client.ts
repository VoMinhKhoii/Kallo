// ---------------------------------------------------------------------------
// Dashboard reads — client-side REST helpers
// ---------------------------------------------------------------------------
// GETs instead of Server Actions so the dashboard's reads run in parallel (the
// browser runs actions one at a time). Same functions as the mobile routes.

import { request } from '@/lib/api/client-fetch';
import type {
  HeatmapData,
  HeatmapRange,
  WeightRange,
} from '@/lib/core/types/dashboard';
import type { WeightSummaryData } from '@/lib/core/types/weight';

export function fetchCalorieAdherenceHeatmap(input: {
  range: HeatmapRange;
  timezoneOffset: number;
}): Promise<HeatmapData> {
  return request(
    `/api/v1/dashboard/heatmap?range=${input.range}&tz=${input.timezoneOffset}`
  );
}

export function fetchWeightSummary(input: {
  range: WeightRange;
  timezoneOffset: number;
}): Promise<WeightSummaryData> {
  return request(
    `/api/v1/weight/summary?range=${input.range}&tz=${input.timezoneOffset}`
  );
}
