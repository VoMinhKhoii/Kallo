'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useDailyMeals } from '@/hooks/meals/queries/use-daily-meals';
import { useWeightSummary } from '@/hooks/weight/use-weight-summary';
import type {
  DashboardProfile,
  HeatmapRange,
  TimeRange,
} from '@/lib/core/types/dashboard';
import { fetchCalorieAdherenceHeatmap } from '@/lib/domain/dashboard/dashboard-client';
import {
  buildTodayNutritionData,
  mapPersistedMealsToMealEntries,
} from '@/lib/domain/dashboard/today';

interface UseDashboardQueriesInput {
  todayDate: string;
  profile: DashboardProfile;
  weightRange: TimeRange;
  heatmapRange: HeatmapRange;
  hasMeasuredHeatmap: boolean;
  heatmapLoadErrorMessage: string;
}

export function useDashboardQueries({
  todayDate,
  profile,
  weightRange,
  heatmapRange,
  hasMeasuredHeatmap,
  heatmapLoadErrorMessage,
}: UseDashboardQueriesInput) {
  const heatmapErrorShown = useRef(false);
  // Not gated on the progress card's layout: the range is fixed, so the read
  // starts with the page instead of a render later.
  const weightSummaryQuery = useWeightSummary(weightRange);
  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'heatmapData', heatmapRange],
    queryFn: () => {
      const timezoneOffset = new Date().getTimezoneOffset();

      return fetchCalorieAdherenceHeatmap({
        range: heatmapRange,
        timezoneOffset,
      });
    },
    enabled: hasMeasuredHeatmap,
    staleTime: 60_000,
    // The range follows the card's width a week at a time, so a resize asks
    // for a new span; keep the last grid up rather than flashing a skeleton.
    placeholderData: keepPreviousData,
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
    heatmapQuery,
    todayMeals,
    todayNutrition,
    weightSummary: weightSummaryQuery.data,
    weightSummaryQuery,
  };
}
