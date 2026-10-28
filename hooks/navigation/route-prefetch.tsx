'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { mealDatesQueryOptions } from '@/hooks/meals/queries/meal-dates-query';
import { dailyMealsQueryOptions } from '@/hooks/meals/queries/use-daily-meals';
import { loggingDayQueryOptions } from '@/hooks/meals/queries/use-logging-day';
import { weightSummaryQueryOptions } from '@/hooks/weight/use-weight-summary';
import { getTodayDateString } from '@/lib/domain/dashboard/today';
import { nutritionOverviewQueryOptions } from '@/lib/domain/nutrition/nutrition-client';

/**
 * Starts loading a tab's first data the moment the user shows intent to open
 * it (pointer over, focus, or a finger down on its nav link), so the reads
 * are already in flight, or done, when the page renders, instead of starting
 * only after it mounts. Uses each page's own query options, so the page finds
 * the result under the same key; `prefetchQuery` skips anything still fresh,
 * so hovering back and forth costs nothing.
 *
 * Covers the first, layout-independent reads only: the dashboard heatmap's
 * range depends on the measured card width, so it still loads on mount.
 */
function useRoutePrefetch(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useCallback(
    (href: string) => {
      if (!userId) return;
      const today = getTodayDateString();

      switch (href) {
        case '/dashboard':
          void queryClient.prefetchQuery(dailyMealsQueryOptions(today));
          void queryClient.prefetchQuery(weightSummaryQueryOptions('30d'));
          break;
        case '/logging':
          void queryClient.prefetchQuery(
            loggingDayQueryOptions(queryClient, userId, today)
          );
          void queryClient.prefetchQuery(
            mealDatesQueryOptions(userId, new Date().getTimezoneOffset())
          );
          break;
        case '/nutrition':
          void queryClient.prefetchQuery(
            nutritionOverviewQueryOptions(
              'auto',
              'complete',
              new Date().getTimezoneOffset()
            )
          );
          break;
      }
    },
    [queryClient, userId]
  );
}

const RoutePrefetchContext = createContext<(href: string) => void>(() => {});

/** Lets the app's nav links prefetch their tab's data (see `useRoutePrefetch`).
 *  Outside it, the links simply do not prefetch. */
export function RoutePrefetchProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const prefetch = useRoutePrefetch(userId);
  return (
    <RoutePrefetchContext.Provider value={prefetch}>
      {children}
    </RoutePrefetchContext.Provider>
  );
}

/** Event handlers for a nav link: pointer over, keyboard focus, or a finger
 *  down (touch has no hover; it lands ~100 ms before the click). */
export function useNavIntent(href: string) {
  const prefetch = useContext(RoutePrefetchContext);
  const onIntent = () => prefetch(href);
  return {
    onPointerEnter: onIntent,
    onFocus: onIntent,
    onTouchStart: onIntent,
  };
}
