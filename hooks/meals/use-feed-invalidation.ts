'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { dailyMealsKeys } from '@/hooks/meals/use-daily-meals';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import type { ChatMessage } from '@/lib/core/types/meal';
import { nutritionKeys } from '@/lib/domain/nutrition/query-keys';

/** Cache invalidation for analysis-complete and barcode-save events. */
export function useFeedInvalidation(args: {
  userId: string;
  selectedDate: string;
  messages: ChatMessage[];
  streamingMsgId: string | null;
}) {
  const { userId, selectedDate, messages, streamingMsgId } = args;
  const queryClient = useQueryClient();

  const handleAnalysisComplete = useCallback(() => {
    const originDate =
      messages.find((message) => message.id === streamingMsgId)?.loggedDate ??
      selectedDate;

    // byUserDate is a 3-element key; the actual query uses byUserDateOffset
    // (4 elements, including the tz offset). This relies on TanStack Query's
    // default prefix matching to invalidate it — do not add `exact: true` here
    // or the yesterday-prompt/day view will show stale totals after a re-log.
    //
    // refetchType: 'none' marks the day stale WITHOUT launching a background
    // refetch. The pending card already renders from the local streamed
    // message, so no immediate network read is needed here — and that refetch
    // (which captures the pre-save snapshot) could otherwise resolve after a
    // confirm and clobber the just-saved meal, leaving the calorie ring stale.
    // The confirm mutation's onSettled refetch reconciles authoritative state.
    queryClient.invalidateQueries({
      queryKey: loggingDayKeys.byUserDate(userId, originDate),
      refetchType: 'none',
    });
    queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    // Prefix match over every cached (range, dayScope) nutrition overview. Its
    // staleTime is 5 minutes, so without this the nutrition page can show
    // pre-log numbers — and each cached selection can hold a different vintage,
    // which reads as the day-scope toggle changing numbers on its own.
    // refetchType: 'none' for the same reason as the day query above: the page
    // isn't mounted here, so mark stale and let it refetch on next visit.
    queryClient.invalidateQueries({
      queryKey: nutritionKeys.all,
      refetchType: 'none',
    });
  }, [messages, userId, queryClient, selectedDate, streamingMsgId]);

  const handleBarcodeSuccess = useCallback(async () => {
    // The barcode flow confirm-and-saves directly (no confirm mutation), so
    // there's no cancel/optimistic choreography guarding it. Cancel any pre-save
    // day fetch still in flight BEFORE invalidating: such a fetch captured the
    // pre-save snapshot and could dedupe onto the refetch and clobber the just-
    // saved meal, leaving the ring stale. Refetch BOTH day queries (the logging
    // ring and the dashboard's daily-meals ring) so neither lags after a save.
    await Promise.all([
      queryClient.cancelQueries({
        queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
      }),
      queryClient.cancelQueries({
        queryKey: dailyMealsKeys.byDate(selectedDate),
      }),
    ]);
    queryClient.invalidateQueries({
      queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
    });
    queryClient.invalidateQueries({
      queryKey: dailyMealsKeys.byDate(selectedDate),
    });
    queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
    queryClient.invalidateQueries({
      queryKey: nutritionKeys.all,
      refetchType: 'none',
    });
  }, [userId, queryClient, selectedDate]);

  return { handleAnalysisComplete, handleBarcodeSuccess };
}
