'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getMsUntilNextLocalMidnight } from '@/lib/dashboard/heatmap-rollover';
import { getTodayDateString } from '@/lib/dashboard/today';

export function useDashboardDateRefresh(queryClient: QueryClient) {
  const [todayDate, setTodayDate] = useState(() => getTodayDateString());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidateDashboardQueries = () => {
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'heatmapData'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['weight-summary'],
      });
    };

    const syncTodayDate = () => {
      setTodayDate((currentDate) => {
        const nextDate = getTodayDateString();
        return currentDate === nextDate ? currentDate : nextDate;
      });
    };

    const scheduleMidnightRefresh = () => {
      timer = setTimeout(() => {
        syncTodayDate();
        invalidateDashboardQueries();
        scheduleMidnightRefresh();
      }, getMsUntilNextLocalMidnight());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTodayDate();
        invalidateDashboardQueries();
      }
    };

    const handleWindowFocus = () => {
      syncTodayDate();
      invalidateDashboardQueries();
    };

    scheduleMidnightRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [queryClient]);

  return todayDate;
}
