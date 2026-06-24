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
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-nham-border/60 border-dashed bg-card/40 px-3 py-3 text-center">
        <span className="font-semibold text-nham-text text-sm">
          {t('noMealsToday')}
        </span>
        <span className="text-[11px] text-nham-stone">
          {t('mealReceiptsHint')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.15em]">
          {t('recentMeals')}
        </span>
        <span className="text-[9px] text-nham-stone">
          {t('mealsLogged', { count: meals.length })}
        </span>
      </div>

      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-1">
        {meals.map((meal, idx) => (
          <div
            key={meal.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-transparent px-2.5 py-1.5 transition-colors hover:border-nham-border/60 hover:bg-card/80"
          >
            <div className="flex min-w-0 items-start gap-2">
              <span
                className="mt-0.5 shrink-0 text-[10px] text-nham-accent tabular-nums leading-none"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {idx + 1}
              </span>
              <span className="line-clamp-2 text-[11px] text-nham-text leading-tight">
                {meal.label}
              </span>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-nham-stone tabular-nums">
              {meal.calories}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
