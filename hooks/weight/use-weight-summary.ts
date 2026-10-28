'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import type { WeightRange, WeightSummaryData } from '@/lib/core/types/weight';
import { fetchWeightSummary } from '@/lib/domain/dashboard/dashboard-client';

export const weightSummaryKeys = {
  all: ['weight-summary'] as const,
  byRange: (range: WeightRange) => ['weight-summary', range] as const,
};

export function useWeightSummary(
  range: WeightRange,
  options?: { enabled?: boolean }
) {
  return useQuery({
    ...weightSummaryQueryOptions(range),
    enabled: options?.enabled ?? true,
  });
}

/** The query `useWeightSummary` runs, shared with the nav's intent prefetch. */
export function weightSummaryQueryOptions(range: WeightRange) {
  const timezoneOffset = new Date().getTimezoneOffset();

  return queryOptions<WeightSummaryData>({
    queryKey: weightSummaryKeys.byRange(range),
    queryFn: () => fetchWeightSummary({ range, timezoneOffset }),
    staleTime: 30_000,
    structuralSharing: true,
  });
}
