'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadLoggingDay } from '@/lib/actions/meals/load-meals';
import type { LoggingDayData } from '@/lib/actions/meals/types';
import { loggingDayKeys } from '@/lib/domain/meals/query-keys';
import { mealShareInvitesKeys } from '@/lib/domain/social/query-keys';

function isToday(dateStr: string): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return dateStr === `${yyyy}-${mm}-${dd}`;
}

export function useLoggingDay(userId: string, date: string) {
  const timezoneOffset = new Date().getTimezoneOffset();
  const queryClient = useQueryClient();

  return useQuery<LoggingDayData>({
    queryKey: loggingDayKeys.byUserDateOffset(userId, date, timezoneOffset),
    queryFn: async () => {
      const day = await loadLoggingDay({ date, timezoneOffset });
      // Loading a day sweeps this user's week-abandoned staging cards, and a
      // card staged from a friend's cheat offer hands that offer back when it
      // goes. So a read can repopulate the invite inbox — and nothing else will
      // say so: the inbox query is watched continuously by the nav badge, so it
      // never goes stale on its own and would keep serving an empty list.
      //
      // In the queryFn rather than an effect on `data` because the flag
      // describes THIS round trip: here it fires once per actual fetch, not on
      // every cache read or re-render that hands the same payload back.
      if (day.releasedInvites) {
        queryClient.invalidateQueries({ queryKey: mealShareInvitesKeys.all });
      }
      return day;
    },
    staleTime: isToday(date) ? 30_000 : 5 * 60_000,
    structuralSharing: true,
  });
}
