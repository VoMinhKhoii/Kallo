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
  getText: () => string;
  setText: (text: string, caret?: number) => void;
  /** Relog is normal-mode only. Checked HERE as well as in the caller's submit
   *  precedence: entries survive a mode switch (only their UI is hidden), so a
   *  caller that forgot the gate would otherwise relog dishes out of cheat
   *  mode. */
  enabled: boolean;
}) {
  const {
    staged,
    relogMeal,
    selectedDate,
    scrollToBottom,
    getText,
    setText,
    enabled,
  } = args;
  const t = useTranslations('logging.feedArea');

  return useCallback(() => {
    if (!enabled || staged.entries.length === 0 || relogMeal.isPending) return;

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
          // Only after the save lands, and only the mention text: anything the
          // user typed around the picks is theirs and survives. On failure
          // nothing is touched, so a dead reference can be dropped and retried
          // rather than losing everything they picked.
          const remaining = staged.consume(getText());
          setText(remaining, remaining.length);
          toast.success(t('savedMeal'));
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('saveError'));
        },
      }
    );
    scrollToBottom();
  }, [
    enabled,
    staged,
    relogMeal,
    selectedDate,
    scrollToBottom,
    getText,
    setText,
    t,
  ]);
}
