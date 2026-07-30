'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { useRelogMeal } from '@/hooks/meals/relog/use-relog-meal';
import type { StagedEntriesApi } from '@/hooks/meals/relog/use-staged-entries';

/**
 * Relog submit: staged references straight to the writer — deterministic, no
 * streaming analysis and no AI call, mirroring the manual path.
 */
export function useRelogSubmit(args: {
  staged: StagedEntriesApi;
  relogMeal: ReturnType<typeof useRelogMeal>;
  selectedDate: string;
  scrollToBottom: () => void;
}) {
  const { staged, relogMeal, selectedDate, scrollToBottom } = args;
  const t = useTranslations('logging.feedArea');

  return useCallback(() => {
    if (staged.entries.length === 0 || relogMeal.isPending) return;

    relogMeal.mutate(
      {
        entries: staged.entries,
        newMealId: crypto.randomUUID(),
        originDate: selectedDate,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
      },
      {
        onSuccess: () => {
          // Clear only after the save lands. On failure the staged rows must
          // survive so the user can drop a dead reference and retry, rather
          // than losing everything they picked.
          staged.clear();
          toast.success(t('savedMeal'));
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('saveError'));
        },
      }
    );
    scrollToBottom();
  }, [staged, relogMeal, selectedDate, scrollToBottom, t]);
}
