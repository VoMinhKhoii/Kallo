'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useDailyMeals } from '@/hooks/use-daily-meals';
import { useWeightSummary } from '@/hooks/use-weight-summary';
import { loadCalorieAdherenceHeatmap } from '@/lib/actions/dashboard';
import { buildCalorieAdherenceHeatmapData } from '@/lib/dashboard/adherence';
import {
  buildTodayNutritionData,
  mapPersistedMealsToMealEntries,
} from '@/lib/dashboard/today';
import type {
  DashboardProfile,
  HeatmapRange,
  TimeRange,
} from '@/lib/types/dashboard';

interface UseDashboardQueriesInput {
  todayDate: string;
  profile: DashboardProfile;
  weightRange: TimeRange;
  heatmapRange: HeatmapRange;
  hasMeasuredProgress: boolean;
  hasMeasuredHeatmap: boolean;
  heatmapLoadErrorMessage: string;
}

export function useDashboardQueries({
  todayDate,
  profile,
  weightRange,
  heatmapRange,
  hasMeasuredProgress,
  hasMeasuredHeatmap,
  heatmapLoadErrorMessage,
}: UseDashboardQueriesInput) {
  const heatmapErrorShown = useRef(false);
  const weightSummaryQuery = useWeightSummary(weightRange, {
    enabled: hasMeasuredProgress,
  });
  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'heatmapData', heatmapRange],
    queryFn: () => {
      const timezoneOffset = new Date().getTimezoneOffset();

      return loadCalorieAdherenceHeatmap({
        range: heatmapRange,
        timezoneOffset,
      });
    },
    enabled: hasMeasuredHeatmap,
    staleTime: 60_000,
  });
  const dailyMealsQuery = useDailyMeals(todayDate);
  const persistedMeals = dailyMealsQuery.data ?? [];

  useEffect(() => {
    if (!heatmapQuery.isError) {
      heatmapErrorShown.current = false;
      return;
    }

    if (heatmapErrorShown.current) return;

    heatmapErrorShown.current = true;
    console.error('[dashboard] heatmap query failed', heatmapQuery.error);
    toast.error(heatmapLoadErrorMessage);
  }, [heatmapLoadErrorMessage, heatmapQuery.error, heatmapQuery.isError]);

  const emptyHeatmapData = useMemo(() => {
    const timezoneOffset = new Date().getTimezoneOffset();

    return buildCalorieAdherenceHeatmapData({
      range: heatmapRange,
      dailyCalories: [],
      calorieTarget: null,
      timezoneOffset,
    });
  }, [heatmapRange]);
  const todayMeals = useMemo(
    () => mapPersistedMealsToMealEntries(persistedMeals),
    [persistedMeals]
  );
  const todayNutrition = useMemo(
    () => buildTodayNutritionData(persistedMeals, profile),
    [persistedMeals, profile]
  );

  // De-emphasized weekly reassurance: sum the last 7 logged days' calories from
  // the already-loaded heatmap (cheat days included — no exclusion). Derived
  // from `ratio × target`; only shown once real data is present.
  const weekly = useMemo(() => {
    const data = heatmapQuery.data;
    const target = profile.calorieTarget;
    if (!data || target <= 0) {
      return { consumed: 0, target: target * 7, hasData: false };
    }
    const days = data.cells
      .flat()
      .filter((cell) => cell.status === 'logged' && cell.ratio !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
    const consumed = days.reduce(
      (sum, cell) => sum + (cell.ratio ?? 0) * target,
      0
    );
    return {
      consumed: Math.round(consumed),
      target: target * 7,
      hasData: days.length > 0,
    };
  }, [heatmapQuery.data, profile.calorieTarget]);

  return {
    dailyMealsQuery,
    heatmapData: heatmapQuery.data,
    heatmapQuery,
    resolvedHeatmapData: heatmapQuery.data ?? emptyHeatmapData,
    todayMeals,
    todayNutrition,
    weekly,
    weightSummary: weightSummaryQuery.data,
    weightSummaryQuery,
  };
}
