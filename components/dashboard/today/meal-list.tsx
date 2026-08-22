'use client';

import { useLocale, useTranslations } from 'next-intl';
import { compositionFromGrams } from '@/components/shared/nutrition/composition';
import { CompositionBar } from '@/components/shared/nutrition/composition-bar';
import { MacroScale } from '@/components/shared/nutrition/macro-scale';
import { formatTime } from '@/lib/core/date/format-time';
import type { MealEntry } from '@/lib/core/types/dashboard';

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

      {/* Rows follow the Circle feed's vocabulary, because a meal should read
          the same whether you are looking at your own dock or at a friend's
          post: the name with its time, the calorie figure with its unit left
          quiet, the composition bar, then the macro figures under it. Dropped
          from the feed's version: the avatar, the author, the action row and
          the replies — social affordances with nothing to say on your own
          dashboard. The meal name takes the bold-ink identity slot the
          author's name held there. */}
      <div className="flex min-h-0 flex-col divide-y divide-kallo-border/50 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {meals.map((meal) => (
          <MealRow key={meal.id} meal={meal} />
        ))}
      </div>
    </div>
  );
}

function MealRow({ meal }: { meal: MealEntry }) {
  const locale = useLocale();
  const composition = compositionFromGrams({
    protein: meal.proteinG,
    carbohydrate: meal.carbsG,
    fat: meal.fatG,
  });

  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="line-clamp-2 min-w-0 font-medium text-kallo-text text-sm leading-snug">
          {meal.label}
        </span>
        <time
          className="shrink-0 text-kallo-text-muted text-xs tabular-nums"
          dateTime={meal.loggedAt}
        >
          {formatTime(meal.loggedAt, locale)}
        </time>
      </div>

      {/* The figure carries the mass, not the word. */}
      <span className="text-kallo-text-muted text-xs">
        <span className="font-medium font-sans-display text-kallo-text text-sm tabular-nums">
          {meal.calories.toLocaleString(locale)}
        </span>{' '}
        kcal
      </span>

      {composition.totalKcal > 0 && (
        <>
          <CompositionBar
            className="mt-1"
            segments={composition.segments}
            variant="compact"
          />
          <MacroScale
            carbohydrate={meal.carbsG}
            className="mt-1"
            fat={meal.fatG}
            protein={meal.proteinG}
          />
        </>
      )}
    </div>
  );
}
