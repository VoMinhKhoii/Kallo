'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import type { ChatMessage } from '@/lib/types/meal';

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
  }, [messages, userId, queryClient, selectedDate, streamingMsgId]);

  const handleBarcodeSuccess = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
    });
    queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
  }, [userId, queryClient, selectedDate]);

  return { handleAnalysisComplete, handleBarcodeSuccess };
}
