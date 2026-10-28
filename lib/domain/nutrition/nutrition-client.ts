// ---------------------------------------------------------------------------
// Nutrition reads — client-side REST helper
// ---------------------------------------------------------------------------
// A GET instead of the Server Action, so the overview does not wait in the
// browser's one-at-a-time action queue. Same function as the mobile route.

import { queryOptions } from '@tanstack/react-query';
import { request } from '@/lib/api/client-fetch';
import { nutritionKeys } from '@/lib/domain/nutrition/query-keys';
import type {
  NutritionDayScope,
  NutritionOverview,
  NutritionRangeInput,
} from '@/lib/domain/nutrition/types';

export function fetchNutritionOverview(input: {
  range: NutritionRangeInput;
  timezoneOffset: number | null;
  days: NutritionDayScope;
}): Promise<NutritionOverview> {
  const params = new URLSearchParams({ range: input.range, days: input.days });
  if (input.timezoneOffset !== null) {
    params.set('tz', String(input.timezoneOffset));
  }
  return request(`/api/v1/nutrition/overview?${params}`);
}

/** The overview query, shared by the nutrition shell and the nav's intent
 *  prefetch. */
export function nutritionOverviewQueryOptions(
  range: NutritionRangeInput,
  dayScope: NutritionDayScope,
  timezoneOffset: number | null
) {
  return queryOptions({
    queryKey: nutritionKeys.overview(range, dayScope, timezoneOffset ?? 'utc'),
    queryFn: () =>
      fetchNutritionOverview({ range, timezoneOffset, days: dayScope }),
    // 5 minutes — overview is computed from the user's logged meals which
    // change at most once per logging action; a longer staleTime avoids
    // refetching on every focus/visibility change.
    staleTime: 5 * 60_000,
  });
}
