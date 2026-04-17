'use client';

import { useTranslations } from 'next-intl';
import type { MealEntry } from '@/components/dashboard/types';

interface MealListProps {
  meals: MealEntry[];
}

export function MealList({ meals }: MealListProps) {
  const t = useTranslations('dashboard');

  if (meals.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-4">
        <span className="text-[12px] text-nham-stone">{t('noMealsToday')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.15em]">
          {t('recentMeals')}
        </span>
        <span className="text-[9px] text-nham-stone">
          {meals.length} logged
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {meals.map((meal, idx) => (
          <div
            key={meal.id}
            className="flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-nham-hover/60"
          >
            <div className="flex min-w-0 items-start gap-2">
              <span
                className="mt-0.5 shrink-0 text-[10px] text-nham-accent tabular-nums leading-none"
                style={{ fontFamily: 'Lora, serif' }}
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
