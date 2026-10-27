'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { MealRow } from '@/components/dashboard/today/meal-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyMeals } from '@/hooks/meals/queries/use-daily-meals';
import { mapPersistedMealsToMealEntries } from '@/lib/domain/dashboard/today';

/**
 * The meals logged on one day, oldest first — the order the day was eaten in,
 * which is how a user checks it for a missing meal. Reuses the dashboard dock's
 * row so a meal reads the same here as under Today.
 */
export function AwaitingDayMeals({ date }: { date: string }) {
  const t = useTranslations('dashboard');
  const query = useDailyMeals(date);
  const meals = useMemo(
    () => mapPersistedMealsToMealEntries(query.data ?? []).reverse(),
    [query.data]
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 py-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl bg-kallo-hover" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-2 py-3">
        <p className="text-[13px] text-kallo-text-muted">
          {t('adherenceHeatmap.dayDialog.loadError')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl font-sans-display"
          onClick={() => void query.refetch()}
        >
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-kallo-border/50">
      {meals.map((meal) => (
        <MealRow key={meal.id} meal={meal} />
      ))}
    </div>
  );
}
