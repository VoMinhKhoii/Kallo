'use client';

import { useTranslations } from 'next-intl';
import { type RefObject, useCallback } from 'react';
import { toast } from 'sonner';
import type { useSaveManualMeal } from '@/hooks/meals/mutations/use-save-manual-meal';
import {
  completeItems,
  type ManualMealItem,
} from '@/lib/domain/logging/manual-logging';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';
import { track } from '@/lib/infra/telemetry/analytics/track';

/** Save a manual meal: its foods at their grams, and its optional name. */
export type ManualSave = (
  items: ManualMealItem[],
  name: string
) => Promise<void>;

/**
 * Manual (Cronometer-style) save: ingredient ids + grams straight to the save
 * endpoint — deterministic, no streaming analysis and no AI call — through
 * the optimistic save. Resolves once the server has the meal, saying so;
 * rejects on failure — the mutation's rollback has already said why (one
 * toast either way) — so a caller can keep what the user built. The phone
 * sheets call it directly; the composer rows through `useManualSubmit`.
 */
export function useManualSave(args: {
  saveManualMeal: ReturnType<typeof useSaveManualMeal>;
  selectedDate: string;
  scrollToBottom: () => void;
}): ManualSave {
  const { saveManualMeal, selectedDate, scrollToBottom } = args;
  const t = useTranslations('logging.feedArea');

  return useCallback(
    async (items, name) => {
      const saving = saveManualMeal.mutateAsync({
        mealId: crypto.randomUUID(),
        originDate: selectedDate,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        items,
        // Blank is no name: the contract would reject an empty string.
        name: name.trim() || undefined,
      });
      // The optimistic card is in the feed already; bring it into view.
      scrollToBottom();
      // A failure rejects here untouched: `rollbackOptimisticMeal` (the
      // mutation's onError) has already toasted it.
      await saving;
      toast.success(t('savedMeal'));
      track('meal_logged', { method: 'manual' });
    },
    [saveManualMeal, selectedDate, scrollToBottom, t]
  );
}

/**
 * The md+ composer's submit: its complete rows through `save`, clearing the
 * composer only once the save lands — on failure the rows stay, so the user
 * is never left with an empty composer and nothing to recover.
 */
export function useManualSubmit(args: {
  inputRef: RefObject<MealInputHandle | null>;
  save: ManualSave;
  isSaving: boolean;
}) {
  const { inputRef, save, isSaving } = args;
  return useCallback(() => {
    const input = inputRef.current;
    const items = completeItems(input?.getManualRows() ?? []);
    if (items.length === 0 || isSaving) return;
    save(items, input?.getManualName() ?? '').then(
      () => input?.clear(),
      // Already said why; the rows stay for another try.
      () => {}
    );
  }, [inputRef, save, isSaving]);
}
