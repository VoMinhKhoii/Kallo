'use client';

import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { type HeroMeal, mealTotals } from './logged-meals';

/**
 * The expanded body of a logged-meal card: a row per dish, then the totals.
 *
 * Split out for the same reason the product splits it — `meal-details.tsx`
 * sits beside `precise-meal-card.tsx` there, because the card shell and the
 * derivation table change for different reasons and read better apart.
 */
export function LoggedMealDetails({ meal }: { meal: HeroMeal }) {
  const t = useTranslations(`landing.hero.meals.${meal.id}.items`);
  const tTotal = useTranslations('landing.hero');
  const totals = mealTotals(meal);

  return (
    <div className="mt-5 border-nham-border border-t pt-4">
      <div className="mb-4 space-y-1">
        {meal.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 py-2 font-sans-display text-[13px]"
          >
            <span className="min-w-0 truncate font-medium text-nham-text">
              {t(item.id)}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex gap-1 text-[9px] text-nham-text-muted tabular-nums">
                <span>P:{formatMacroValue(item.protein)}</span>
                <span>C:{formatMacroValue(item.carbs)}</span>
                <span>F:{formatMacroValue(item.fat)}</span>
              </div>
              <span className="font-bold text-nham-text tabular-nums">
                {formatCaloriesValue(item.calories)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-nham-border/50 border-t pt-3">
        <span className="font-bold font-sans-display text-[13px] text-nham-text">
          {tTotal('total')}
        </span>
        <div className="flex items-center gap-4">
          <span className="font-sans-display text-[11px] text-nham-text-muted tabular-nums">
            P: {formatMacroValue(totals.protein)}
            {'  '}C: {formatMacroValue(totals.carbs)}
            {'  '}F: {formatMacroValue(totals.fat)}
          </span>
          <span className="font-bold font-sans-display text-nham-text tabular-nums">
            {formatCaloriesValue(totals.calories)}
          </span>
        </div>
      </div>
    </div>
  );
}
