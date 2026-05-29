import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { NutritionOverview } from '@/lib/api/contracts/nutrition';
import type { NutritionRangeInput } from '@/lib/nutrition/types';
import { apiGet } from '~/lib/api-client';
import { nutritionKeys } from './keys';

/**
 * Loads the server-built nutrition overview from the REST surface. Mirrors the
 * web `NutritionShell` query exactly: 4-element key by range + timezone bucket,
 * `retry:false`, 5-minute `staleTime`, and `placeholderData: keepPreviousData`
 * so the editorial layout stays in place while a new range refetches.
 *
 * `range` accepts the input enum (incl. `'auto'`, which the server resolves to
 * a concrete range). `tz` is the raw `getTimezoneOffset()` (positive west of
 * UTC); the server buckets by it.
 */
export function useNutritionOverview(
  range: NutritionRangeInput,
  enabled = true
) {
  const tz = new Date().getTimezoneOffset();
  return useQuery<NutritionOverview>({
    queryKey: nutritionKeys.overview(range, tz),
    queryFn: () =>
      apiGet<NutritionOverview>(
        `/api/v1/nutrition/overview?range=${range}&tz=${tz}`
      ),
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    enabled,
  });
}
