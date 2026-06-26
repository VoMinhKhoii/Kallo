'use client';

import { useQuery } from '@tanstack/react-query';
import type { LoggingDayData } from '@/lib/actions/meals';
import { loadLoggingDay } from '@/lib/actions/meals';

export const loggingDayKeys = {
  all: ['logging-day'] as const,
  // 3-element key. NOTE: this is intentionally a PREFIX of byUserDateOffset and
  // is the key mutations target (cancel/setQueriesData/invalidateQueries) so a
  // write reaches the active query regardless of its tz-offset segment. It is
  // NOT exact-matchable: getQueryData(byUserDate(...)) returns undefined — only
  // the *Queries (prefix-matching) APIs hit the stored entry. Do not add
  // `exact: true` against this key in the mutation callbacks.
  byUserDate: (userId: string, date: string) =>
    ['logging-day', userId, date] as const,
  // 4-element key the query is actually registered under (see useLoggingDay).
  byUserDateOffset: (userId: string, date: string, timezoneOffset: number) =>
    ['logging-day', userId, date, timezoneOffset] as const,
};

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
