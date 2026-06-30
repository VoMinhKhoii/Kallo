'use client';

import { useQuery } from '@tanstack/react-query';
import type { PersistedMeal } from '@/lib/actions/meals';
import { loadMealsByDate } from '@/lib/actions/meals';

/** Query key factory for daily meals */
export const dailyMealsKeys = {
  all: ['daily-meals'] as const,
  byDate: (date: string) => ['daily-meals', date] as const,
};

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
  const timezoneOffset = new Date().getTimezoneOffset();

  return useQuery<PersistedMeal[]>({
    queryKey: dailyMealsKeys.byDate(date),
    queryFn: () => loadMealsByDate({ date, timezoneOffset }),
    staleTime: isToday(date) ? 30_000 : 5 * 60_000,
    structuralSharing: true,
  });
}
