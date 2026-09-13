'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { markDayCompleteAction } from '@/lib/actions/meals/day/mark-day-complete';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import { nutritionKeys } from '@/lib/domain/nutrition/query-keys';

/**
 * "That's everything I ate" — attest that an under-logged day is in fact
 * complete, so it rejoins the trends at the calories actually logged.
 *
 * Deliberately NOT optimistic, unlike every other mutation in this folder. The
 * mark is one-way (there is no un-mark route), so a rolled-back optimistic flip
 * would be the only way back from a failed write — and a UI that briefly claims
 * an attestation the server never stored is worse here than one extra round
 * trip on a rare, deliberate click. The refetched day's `markedComplete` is
 * what takes the notice down.
 *
 * Completeness is read from three different bundles, so all three are
 * invalidated: the logging day (the notice itself), the dashboard's daily-meals
 * ring, and the nutrition overviews whose averages and heatmap decide whether
 * the day counts. Without the last two, the heatmap would keep painting the day
 * as set aside until something unrelated refetched it.
 */
export function useMarkDayComplete(userId: string, date: string) {
  const t = useTranslations('logging.feedArea.partialDayNotice');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      markDayCompleteAction({
        date,
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    onError: () => {
      toast.error(t('markError'));
    },
    onSuccess: () => {
      // byUserDate is a 3-element PREFIX of the key the query is registered
      // under; prefix matching is what reaches it. Do not add `exact: true`.
      // This one refetches actively (no refetchType override): the day is
      // mounted and its `markedComplete` is the only thing that clears the
      // notice the user just acted on.
      queryClient.invalidateQueries({
        queryKey: loggingDayKeys.byUserDate(userId, date),
      });
      queryClient.invalidateQueries({ queryKey: dailyMealsKeys.byDate(date) });
      // Not mounted from here, so mark stale and let the next visit refetch.
      queryClient.invalidateQueries({
        queryKey: nutritionKeys.all,
        refetchType: 'none',
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard'],
        refetchType: 'none',
      });
    },
  });
}
