'use client';

import { useQuery } from '@tanstack/react-query';
import { loadWeightSummaryAction } from '@/lib/actions/weight';
import type { WeightRange, WeightSummaryData } from '@/lib/types/weight';

export const weightSummaryKeys = {
  all: ['weight-summary'] as const,
  byRange: (range: WeightRange) => ['weight-summary', range] as const,
};

export function useWeightSummary(
  range: WeightRange,
  options?: { enabled?: boolean }
) {
  const timezoneOffset = new Date().getTimezoneOffset();

  return useQuery<WeightSummaryData>({
    queryKey: weightSummaryKeys.byRange(range),
    queryFn: () => loadWeightSummaryAction({ range, timezoneOffset }),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    structuralSharing: true,
  });
}
