'use client';

import { useTranslations } from 'next-intl';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import type { PersistedMeal } from '@/lib/actions/meals/types';

/** Expanded details: per-dish macro rows plus the meal totals line. */
export function MealDetails({
  meal,
  totals,
}: {
  meal: PersistedMeal;
  totals: { calories: string; protein: string; carbs: string; fat: string };
}) {
  const t = useTranslations('logging.persistedMealCard');
  return (
    <div className="mt-5 border-kallo-border border-t pt-4">
      <div className="mb-4 space-y-1">
        {meal.mealItemGroups.map((group) => {
          const gProtein = formatMacroOrNA(group.nutrition.proteinG);
          const gCarbs = formatMacroOrNA(group.nutrition.carbohydrateG);
          const gFat = formatMacroOrNA(group.nutrition.fatG);
          const gCal = formatCaloriesOrNA(group.nutrition.caloriesKcal);
          return (
            <div
              key={`${group.order}-${group.name}`}
              className="flex items-center justify-between py-2 font-sans-display text-[13px]"
            >
              <span className="min-w-0 truncate font-medium text-kallo-text">
                {group.name}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex gap-2 text-[10px] text-kallo-text-muted tabular-nums">
                  <span className="text-right">P:{gProtein}</span>
                  <span className="text-right">C:{gCarbs}</span>
                  <span className="text-right">F:{gFat}</span>
                </div>
                <span className="text-right font-bold text-kallo-text tabular-nums">
                  {gCal}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-kallo-border/50 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="font-bold font-sans-display text-[13px] text-kallo-text">
            {t('total')}
          </span>
          <div className="flex items-center gap-4">
            <span className="font-sans-display text-[11px] text-kallo-text-muted tabular-nums">
              P: {totals.protein}
              {'  '}C: {totals.carbs}
              {'  '}F: {totals.fat}
            </span>
            <span className="font-bold font-sans-display text-kallo-text tabular-nums">
              {totals.calories}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
