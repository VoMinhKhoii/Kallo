'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyMeals } from '@/hooks/use-daily-meals';
import { useWeightSummary } from '@/hooks/use-weight-summary';
import { loadCalorieAdherenceHeatmap } from '@/lib/actions/dashboard';
import { buildCalorieAdherenceHeatmapData } from '@/lib/dashboard/adherence';
import { chooseRenderedHeatmapRange } from '@/lib/dashboard/heatmap-range';
import { getMsUntilNextLocalMidnight } from '@/lib/dashboard/heatmap-rollover';
import {
  buildTodayNutritionData,
  getTodayDateString,
  mapPersistedMealsToMealEntries,
} from '@/lib/dashboard/today';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { ProgressStory } from './progress/progress-story';
import { SectionHeader } from './section-header';
import { FloatingMealTrigger } from './today/meal-trigger';
import { TodayDock } from './today/today-dock';
import type { HeatmapRange, TimeRange } from './types';

export interface DashboardProfile {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

function getWeekTitle(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const year = sunday.getFullYear();

  return `Week of ${fmt(monday)} – ${fmt(sunday)}, ${year}`;
}

function ProgressSectionSkeleton({ range }: { range: HeatmapRange }) {
  const heatmapSquares = range === '30d' ? 35 : range === '90d' ? 70 : 182;

  return (
    <div className="flex h-full gap-3">
      <div className="flex flex-1 flex-col rounded-2xl border border-nham-border/60 bg-card p-3 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1 h-3 w-28 rounded-full bg-nham-track" />
        <Skeleton className="min-h-[220px] w-full flex-1 rounded-xl bg-nham-track" />
      </div>
      <div className="flex shrink-0 flex-col rounded-2xl border border-nham-border/60 bg-card px-3 pt-3 pb-2 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1.5 h-3 w-28 rounded-full bg-nham-track" />
        <div className="flex flex-1 items-center gap-1">
          <div className="flex shrink-0 flex-col gap-1" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[19px] w-3 rounded-sm bg-nham-track"
              />
            ))}
          </div>
          <div className="grid flex-1 gap-1" aria-hidden="true">
            {Array.from({ length: heatmapSquares }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[19px] w-[19px] rounded-[3px] bg-nham-track"
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-2 w-12 rounded-full bg-nham-track" />
          <Skeleton className="h-1.5 flex-1 rounded-full bg-nham-track" />
          <Skeleton className="h-2 w-12 rounded-full bg-nham-track" />
        </div>
      </div>
    </div>
  );
}

interface DashboardShellProps {
  profile: DashboardProfile;
}

export function DashboardShell({ profile }: DashboardShellProps) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [progressWidth, setProgressWidth] = useState(900);
  const [heatmapSize, setHeatmapSize] = useState({
    width: 1200,
    height: 280,
  });
  const [todayDate, setTodayDate] = useState(() => getTodayDateString());
  const heatmapErrorShown = useRef(false);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);
  const weekTitle = useMemo(() => getWeekTitle(), []);
  const weightRange: TimeRange = progressWidth >= 620 ? '90d' : '30d';
  const renderedHeatmapRange = chooseRenderedHeatmapRange({
    preferredRange: 'year',
    availableWidth: heatmapSize.width,
    availableHeight: heatmapSize.height,
    weekCount: { '30d': 5, '90d': 14, year: 53 },
  });
  const emptyHeatmapData = useMemo(() => {
    const timezoneOffset = new Date().getTimezoneOffset();

    return buildCalorieAdherenceHeatmapData({
      range: renderedHeatmapRange,
      dailyCalories: [],
      calorieTarget: null,
      timezoneOffset,
    });
  }, [renderedHeatmapRange]);
  const { data: weightSummary } = useWeightSummary(weightRange);

  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'heatmapData', renderedHeatmapRange],
    queryFn: () => {
      const timezoneOffset = new Date().getTimezoneOffset();

      return loadCalorieAdherenceHeatmap({
        range: renderedHeatmapRange,
        timezoneOffset,
      });
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!heatmapQuery.isError) {
      heatmapErrorShown.current = false;
      return;
    }

    if (heatmapErrorShown.current) return;

    heatmapErrorShown.current = true;
    console.error('[dashboard] heatmap query failed', heatmapQuery.error);
    toast.error('Unable to load the progress section. Please try again.');
  }, [heatmapQuery.error, heatmapQuery.isError]);

  useEffect(() => {
    const progressNode = progressContainerRef.current;
    const heatmapNode = heatmapContainerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === progressNode) {
          const width = entry.contentRect.width;
          if (width > 0) setProgressWidth(width);
          continue;
        }

        if (entry.target === heatmapNode) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) setHeatmapSize({ width, height });
        }
      }
    });

    if (progressNode) observer.observe(progressNode);
    if (heatmapNode) observer.observe(heatmapNode);
    return () => observer.disconnect();
  }, []);

  const heatmapData = heatmapQuery.data;
  const { data: persistedMeals = [] } = useDailyMeals(todayDate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidateDashboardQueries = () => {
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'heatmapData'],
      });
    };

    const syncTodayDate = () => {
      setTodayDate((currentDate) => {
        const nextDate = getTodayDateString();
        return currentDate === nextDate ? currentDate : nextDate;
      });
    };

    const scheduleMidnightRefresh = () => {
      timer = setTimeout(() => {
        syncTodayDate();
        invalidateDashboardQueries();
        scheduleMidnightRefresh();
      }, getMsUntilNextLocalMidnight());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTodayDate();
        invalidateDashboardQueries();
      }
    };

    const handleWindowFocus = () => {
      syncTodayDate();
      invalidateDashboardQueries();
    };

    scheduleMidnightRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [queryClient]);

  const resolvedHeatmapData = heatmapData ?? emptyHeatmapData;
  const todayMeals = useMemo(
    () => mapPersistedMealsToMealEntries(persistedMeals),
    [persistedMeals]
  );
  const todayNutrition = useMemo(
    () => buildTodayNutritionData(persistedMeals, profile),
    [persistedMeals, profile]
  );

  return (
    <main
      className="relative min-h-[calc(100dvh-5.25rem)] overflow-x-hidden bg-nham-surface/30 xl:h-[calc(100dvh-1.5rem)] xl:min-h-0 xl:overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <div className="min-h-full px-3 py-3 pb-24 sm:px-5 sm:py-4 lg:px-8 xl:h-full xl:min-h-0 xl:overflow-hidden xl:py-3 xl:pb-3">
        <div className="mx-auto grid max-w-[1440px] gap-4 sm:gap-5 xl:h-full xl:min-h-0 xl:grid-rows-[minmax(150px,0.78fr)_minmax(220px,1.1fr)_minmax(240px,1.12fr)] xl:gap-3">
          <section className="flex min-h-0 flex-col gap-1.5">
            <SectionHeader title={weekTitle} />
            <div className="xl:min-h-0 xl:flex-1">
              <TodayDock nutrition={todayNutrition} meals={todayMeals} />
            </div>
          </section>

          <section
            ref={progressContainerRef}
            className="flex min-w-0 flex-col gap-1.5 xl:min-h-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
                {t('progress')}
              </span>
              <span className="font-medium text-[11px] text-nham-stone">
                {weightRange === '90d' ? '90 days' : '30 days'}
              </span>
            </div>
            <div className="xl:min-h-0 xl:flex-1">
              <ProgressStory
                weightSummary={weightSummary}
                range={weightRange}
              />
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-1.5 xl:min-h-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
                Consistency
              </span>
              <span className="font-medium text-[11px] text-nham-stone">
                {renderedHeatmapRange === 'year'
                  ? 'Year'
                  : renderedHeatmapRange === '90d'
                    ? '90 days'
                    : '30 days'}
              </span>
            </div>
            <div
              ref={heatmapContainerRef}
              className="min-h-[310px] rounded-[1.5rem] border border-nham-border/60 bg-card p-3 shadow-[0_10px_32px_rgba(44,36,22,0.05)] sm:min-h-[340px] md:min-h-[360px] xl:min-h-0 xl:flex-1 xl:p-4"
            >
              {!heatmapData ? (
                <ProgressSectionSkeleton range={renderedHeatmapRange} />
              ) : (
                <AdherenceHeatmap
                  data={resolvedHeatmapData}
                  range={renderedHeatmapRange}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      <FloatingMealTrigger />
    </main>
  );
}
