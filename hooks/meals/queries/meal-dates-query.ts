'use client';

import { queryOptions } from '@tanstack/react-query';
import type { MealDateSummary } from '@/lib/domain/logging/types';
import { fetchMealDateSummaries } from '@/lib/domain/meals/meals-client';

/** The logging timeline's per-day summaries, shared by the logging shell and
 *  the nav's intent prefetch. */
export function mealDatesQueryOptions(userId: string, timezoneOffset: number) {
  return queryOptions<MealDateSummary[]>({
    queryKey: ['meal-dates', userId, timezoneOffset],
    queryFn: () => fetchMealDateSummaries({ timezoneOffset }),
    staleTime: 60_000,
  });
}
