'use client';

import { useMemo } from 'react';
import { useLoggingDay } from '@/hooks/meals/queries/use-logging-day';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/assemble/goal-adjustment';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import type { IncompleteTotals } from '@/lib/core/types/meal';
import type { LoggingProfile } from '@/lib/domain/logging/types';

/**
 * Day-level data for the feed: the logging-day query plus the derived
 * ordering, macro totals, targets, and which totals are incomplete.
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

  // A meal with an unknown value still counts what it knows, so a total with
  // a gap is a floor, not a wrong number: the dial shows it as `≥`. Hiding the
  // whole summary over one blank threw away every value that WAS known.
  const incompleteTotals = useMemo<IncompleteTotals>(() => {
    const hasGap = (key: keyof NutritionValues) =>
      persistedMeals.some((meal) => meal.nutrition[key] == null);
    return {
      calories: hasGap('caloriesKcal'),
      protein: hasGap('proteinG'),
      carbs: hasGap('carbohydrateG'),
      fat: hasGap('fatG'),
    };
  }, [persistedMeals]);

  return {
    isDayError,
    isDayLoading,
    isDayRetrying,
    refetchLoggingDay,
    /** The user attested this day is fully logged; the notice must stay down. */
    markedComplete: loggingDay?.markedComplete ?? false,
    persistedMeals,
    orderedPersistedMeals,
    pendingConfirmations,
    targets,
    dailyTotals,
    incompleteTotals,
  };
}
