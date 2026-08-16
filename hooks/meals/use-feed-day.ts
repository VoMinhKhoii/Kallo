'use client';

import { useMemo } from 'react';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { useLoggingDay } from '@/hooks/meals/use-logging-day';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/assemble/goal-adjustment';

/**
 * Day-level data for the feed: the logging-day query plus the derived
 * ordering, macro totals, targets, and legacy-data flags FeedArea renders.
 */
export function useFeedDay(args: {
  profile: LoggingProfile;
  selectedDate: string;
  isDateNavigationPending: boolean;
}) {
  const { profile, selectedDate, isDateNavigationPending } = args;

  const {
    data: loggingDay,
    isError: isDayError,
    isFetching,
    isLoading,
    refetch: refetchLoggingDay,
  } = useLoggingDay(profile.userId, selectedDate);
  const isDayLoading = isLoading || isDateNavigationPending;
  const isDayRetrying = isFetching && !isLoading;
  const persistedMeals = loggingDay?.persistedMeals ?? [];
  const orderedPersistedMeals = useMemo(
    () =>
      persistedMeals.toSorted((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [persistedMeals]
  );
  const pendingConfirmations = loggingDay?.pendingConfirmations ?? [];

  // Compute daily totals from persisted meals
  const targets = useMemo(
    () => ({
      calories: profile.calorieTarget,
      protein: profile.proteinTargetG,
      carbs: profile.carbsTargetG,
      fat: profile.fatTargetG,
    }),
    [
      profile.calorieTarget,
      profile.proteinTargetG,
      profile.carbsTargetG,
      profile.fatTargetG,
    ]
  );

  const dailyTotals = useMemo(() => {
    if (persistedMeals.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    const total = sumDisplayedNutrition(
      persistedMeals.map((meal) => meal.nutrition)
    );

    return {
      calories: Math.round(total.caloriesKcal ?? 0),
      protein: Math.round(total.proteinG ?? 0),
      carbs: Math.round(total.carbohydrateG ?? 0),
      fat: Math.round(total.fatG ?? 0),
    };
  }, [persistedMeals]);

  const hasUnknownDailyMacros = useMemo(
    () =>
      persistedMeals.some(
        (meal) =>
          meal.nutrition.caloriesKcal == null ||
          meal.nutrition.proteinG == null ||
          meal.nutrition.carbohydrateG == null ||
          meal.nutrition.fatG == null
      ),
    [persistedMeals]
  );

  return {
    isDayError,
    isDayLoading,
    isDayRetrying,
    refetchLoggingDay,
    persistedMeals,
    orderedPersistedMeals,
    pendingConfirmations,
    targets,
    dailyTotals,
    hasUnknownDailyMacros,
  };
}
