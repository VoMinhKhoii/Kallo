'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import { logSharedMeal } from '@/lib/groups/client';

function localDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Copy a visible shared meal into today's diary and refresh the canonical
 * logging-day query; the legacy daily-meals cache is intentionally untouched. */
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loggingDayKeys.all });
      toast.success(t('logSuccess'));
    },
    onError: () => toast.error(t('logError')),
  });
}
