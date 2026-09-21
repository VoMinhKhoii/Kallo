'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import { logSharedMeal } from '@/lib/domain/social/circle-client';

function localDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Copy a visible shared meal into my diary — at the SOURCE meal's instant, so
 * possibly on an earlier day than today (`loggedDate` is still sent for shipped
 * clients and ignored by the server). Both invalidations below use `.all`, which
 * is a PREFIX key, so whichever day the copy landed on refetches. Refreshes both
 * day queries:
 * the logging-day query AND the daily-meals cache that still feeds the dashboard
 * calorie ring (use-dashboard-queries reads useDailyMeals(today)). Cancel any
 * in-flight fetches first so a pre-save read can't dedupe onto the refetch and
 * clobber the just-logged meal. */
export function useLogSharedMeal() {
  const t = useTranslations('groups.feed');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { shareId: string; factor: 1 | 0.5 }) =>
      logSharedMeal({
        ...input,
        loggedDate: localDateString(),
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: loggingDayKeys.all }),
        queryClient.cancelQueries({ queryKey: dailyMealsKeys.all }),
      ]);
      queryClient.invalidateQueries({ queryKey: loggingDayKeys.all });
      queryClient.invalidateQueries({ queryKey: dailyMealsKeys.all });
      toast.success(t('logSuccess'));
    },
    onError: () => toast.error(t('logError')),
  });
}
