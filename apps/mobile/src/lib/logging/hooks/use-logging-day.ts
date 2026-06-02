import { useQuery } from '@tanstack/react-query';
import type { LoggingDayData } from '@/lib/api/contracts/meals';
import { apiGet } from '~/lib/api-client';
import { loggingDayKeys, todayDateString } from '~/lib/logging/keys';

/**
 * Loads a day's persisted meals + pending confirmations from the REST surface.
 * Mirrors the web `useLoggingDay` (key, staleTime, structuralSharing) but
 * fetches `GET /api/v1/logging/day` instead of calling the server action.
 */
export function useLoggingDay(userId: string, date: string) {
  const timezoneOffset = new Date().getTimezoneOffset();
  const isToday = date === todayDateString();
  return useQuery<LoggingDayData>({
    queryKey: loggingDayKeys.byUserDateOffset(userId, date, timezoneOffset),
    queryFn: () =>
      apiGet<LoggingDayData>(
        `/api/v1/logging/day?date=${encodeURIComponent(date)}&tz=${timezoneOffset}`
      ),
    staleTime: isToday ? 30_000 : 5 * 60_000,
    structuralSharing: true,
  });
}
