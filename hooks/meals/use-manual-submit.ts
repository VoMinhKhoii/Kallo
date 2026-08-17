'use client';

import { useTranslations } from 'next-intl';
import { type RefObject, useCallback } from 'react';
import { toast } from 'sonner';
import type { MealInputHandle } from '@/components/logging/input/meal-input';
import type { useSaveManualMeal } from '@/hooks/meals/use-meal-mutations';
import { rowIsComplete } from '@/lib/domain/logging/manual-logging';

/**
 * Manual (Cronometer-style) submit: ingredient ids + grams straight to the
 * save endpoint — deterministic, no streaming analysis and no AI call.
 */
export function useManualSubmit(args: {
  inputRef: RefObject<MealInputHandle | null>;
  saveManualMeal: ReturnType<typeof useSaveManualMeal>;
  selectedDate: string;
  scrollToBottom: () => void;
}) {
  const { inputRef, saveManualMeal, selectedDate, scrollToBottom } = args;
  const t = useTranslations('logging.feedArea');

  return useCallback(() => {
    const rows = (inputRef.current?.getManualRows() ?? []).filter(
      rowIsComplete
    );
    if (rows.length === 0 || saveManualMeal.isPending) return;

    saveManualMeal.mutate(
      {
        mealId: crypto.randomUUID(),
        originDate: selectedDate,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        rows,
      },
      {
        onSuccess: () => {
          // Clear only after the save lands — on failure the rolled-back card
          // would otherwise leave the user with an empty composer and no way to
          // recover the rows they typed.
          inputRef.current?.clear();
          toast.success(t('savedMeal'));
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t('saveError'));
        },
      }
    );
    scrollToBottom();
  }, [inputRef, saveManualMeal, selectedDate, scrollToBottom, t]);
}
