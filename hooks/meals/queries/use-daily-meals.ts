'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { fetchMealsByDate } from '@/lib/domain/meals/meals-client';
import { dailyMealsKeys } from '@/lib/domain/meals/query-keys';

function isToday(dateStr: string): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return dateStr === `${yyyy}-${mm}-${dd}`;
}

/**
 * Fetch persisted meals for a given date with SWR staleTime:
 * - Today: 30s (frequently changing as user logs meals)
 * - Past dates: 5min (rarely changes)
 */
export function useDailyMeals(date: string) {
  return useQuery(dailyMealsQueryOptions(date));
}

/** The query `useDailyMeals` runs, shared with the nav's intent prefetch so
 *  both use the same key and fetcher. */
export function dailyMealsQueryOptions(date: string) {
  const timezoneOffset = new Date().getTimezoneOffset();

  return queryOptions<PersistedMeal[]>({
    queryKey: dailyMealsKeys.byDate(date),
    queryFn: () => fetchMealsByDate({ date, timezoneOffset }),
    staleTime: isToday(date) ? 30_000 : 5 * 60_000,
    structuralSharing: true,
  });
}
