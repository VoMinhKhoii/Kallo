'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useDailyMeals } from '@/hooks/meals/use-daily-meals';
import { useWeightSummary } from '@/hooks/weight/use-weight-summary';
import { loadCalorieAdherenceHeatmap } from '@/lib/actions/tracking/dashboard';
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

  return {
    dailyMealsQuery,
    heatmapData: heatmapQuery.data,
    heatmapQuery,
    resolvedHeatmapData: heatmapQuery.data ?? emptyHeatmapData,
    todayMeals,
    todayNutrition,
    weightSummary: weightSummaryQuery.data,
    weightSummaryQuery,
  };
}
