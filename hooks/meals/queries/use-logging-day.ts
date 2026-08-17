'use client';

import { useQuery } from '@tanstack/react-query';
import { loadLoggingDay } from '@/lib/actions/meals/load-meals';
import type { LoggingDayData } from '@/lib/actions/meals/types';
import { loggingDayKeys } from '@/lib/domain/meals/query-keys';

function isToday(dateStr: string): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return dateStr === `${yyyy}-${mm}-${dd}`;
}

export function useLoggingDay(userId: string, date: string) {
  const timezoneOffset = new Date().getTimezoneOffset();

  return useQuery<LoggingDayData>({
    queryKey: loggingDayKeys.byUserDateOffset(userId, date, timezoneOffset),
    queryFn: () => loadLoggingDay({ date, timezoneOffset }),
    staleTime: isToday(date) ? 30_000 : 5 * 60_000,
    structuralSharing: true,
  });
}
