'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { loadMealsByDate } from '@/lib/actions/meals/load-meals';
import { dailyMealsKeys } from '@/lib/domain/meals/query-keys';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Prefetch adjacent dates (yesterday + tomorrow) when selectedDate changes.
 * Uses requestIdleCallback to avoid blocking UI.
 */
export function usePrefetchDates(selectedDate: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const timezoneOffset = new Date().getTimezoneOffset();
    const adjacent = [addDays(selectedDate, -1), addDays(selectedDate, 1)];

    const prefetch = () => {
      for (const date of adjacent) {
        queryClient.prefetchQuery({
          queryKey: dailyMealsKeys.byDate(date),
          queryFn: () => loadMealsByDate({ date, timezoneOffset }),
          staleTime: 5 * 60_000,
        });
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(id);
    }
    // Fallback for environments without requestIdleCallback
    const timeout = setTimeout(prefetch, 100);
    return () => clearTimeout(timeout);
  }, [selectedDate, queryClient]);
}
