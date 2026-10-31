'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useDailyMeals } from '@/hooks/meals/queries/use-daily-meals';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import type { MealEntry } from '@/lib/core/types/dashboard';
import { mapPersistedMealsToMealEntries } from '@/lib/domain/dashboard/today';

/** "35.7g", summed over the meals that measured it; a dash when none did. */
function sumGrams(
  meals: MealEntry[],
  pick: (meal: MealEntry) => number | null,
  locale: string
) {
  const known = meals.map(pick).filter((g): g is number => g != null);
  if (known.length === 0) return '—';
  return `${formatLocalizedNumber(
    known.reduce((a, b) => a + b, 0),
    locale
  )}g`;
}

/**
 * The day's total on one line, the way the logging card's Total row reads:
 * "Total", then P · C · F, then the kcal. Shares the meal list's query, so it
 * draws nothing until the meals have loaded.
 */
export function AwaitingDayTotal({ date }: { date: string }) {
  const t = useTranslations('dashboard.adherenceHeatmap.dayDialog');
  const locale = useLocale();
  const { data } = useDailyMeals(date);
  if (!data || data.length === 0) return null;

  const meals = mapPersistedMealsToMealEntries(data);
  const calories = Math.round(meals.reduce((sum, m) => sum + m.calories, 0));

  return (
    <div
      className="flex items-baseline gap-3 font-sans-display tabular-nums"
      data-testid="awaiting-day-total"
    >
      <span className="font-medium text-[15px] text-kallo-text">
        {t('total')}
      </span>
      <span className="ml-auto flex gap-3 text-kallo-text text-xs">
        <span>P: {sumGrams(meals, (m) => m.proteinG, locale)}</span>
        <span>C: {sumGrams(meals, (m) => m.carbsG, locale)}</span>
        <span>F: {sumGrams(meals, (m) => m.fatG, locale)}</span>
      </span>
      <span className="font-medium text-[15px] text-kallo-text">
        {formatLocalizedNumber(calories, locale)} kcal
      </span>
    </div>
  );
}
