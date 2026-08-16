'use client';

import { useTranslations } from 'next-intl';
import type { MealEntry } from '@/lib/types/dashboard';

interface MealListProps {
  meals: MealEntry[];
}

export function MealList({ meals }: MealListProps) {
  const t = useTranslations('dashboard');

  if (meals.length === 0) {
    return (
      <div className="flex h-full min-h-[96px] flex-col items-center justify-center gap-1 text-center">
        <span className="font-medium text-kallo-text text-sm">
          {t('noMealsToday')}
        </span>
        <span className="text-kallo-text-muted text-xs">
          {t('mealReceiptsHint')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-medium text-kallo-text-muted text-xs uppercase tracking-[0.08em]">
          {t('recentMeals')}
        </span>
        <span className="text-kallo-text-muted text-xs tabular-nums">
          {t('mealsLogged', { count: meals.length })}
        </span>
      </div>

      {/* Plain rows on the card surface — meal name at content-left, kcal in a
          fixed right column so every value lines up (no per-row boxes/borders). */}
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {meals.map((meal) => (
          <div
            key={meal.id}
            className="flex items-baseline justify-between gap-3 py-1"
          >
            <span className="line-clamp-2 min-w-0 text-kallo-text text-sm leading-snug">
              {meal.label}
            </span>
            <span className="shrink-0 text-kallo-text-muted text-xs tabular-nums">
              {meal.calories} kcal
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
