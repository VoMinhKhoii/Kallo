'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useWeightSummary } from '@/hooks/use-weight-summary';
import { loadCalorieAdherenceHeatmap } from '@/lib/actions/dashboard';
import { buildCalorieAdherenceHeatmap } from '@/lib/dashboard/adherence';
import { getMsUntilNextLocalMidnight } from '@/lib/dashboard/heatmap-rollover';
import { cn } from '@/lib/utils';
import { CurrentSection } from './current/current-section';
import {
  getMealsToday,
  getNutritionData,
  getStatsData,
  getVerdictData,
} from './mock-data';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { ProgressSection } from './progress/progress-section';
import { WeightChart } from './progress/weight-chart';
import { SectionHeader } from './section-header';
import { MealTrigger } from './today/meal-trigger';
import { TodaySection } from './today/today-section';
import type { DashboardSnapshot, TimeRange } from './types';

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

function getEmptyHeatmap(range: TimeRange): (number | null)[][] {
  const weekCount = range === '30d' ? 4 : 13;
  return Array.from({ length: 7 }, () => Array.from({ length: weekCount }, () => null));
}

function getEmptyDashboardSnapshot(range: TimeRange): DashboardSnapshot {
  return {
    verdict: {
      weeklyRate: 0,
      totalDelta: 0,
      planStartDate: new Date().toISOString().slice(0, 10),
      status: 'too_early',
      rollingAvg: { start: 0, end: 0 },
      currentWeight: 0,
      proteinDays: [false, false, false, false, false, false, false],
    },
    stats: {
      streak: 0,
      daysLogged: 0,
      avgDeficit: 0,
      todayWeight: null,
      weightPlaceholder: 0,
    },
    nutrition: {
      calories: { current: 0, target: 0 },
      protein: { current: 0, target: 0 },
      carbs: { current: 0, target: 0 },
      fat: { current: 0, target: 0 },
    },
    meals: [],
    heatmap: getEmptyHeatmap(range),
    weightSummary: {
      range,
      weights: [],
      currentWeight: 0,
      todayWeight: null,
      weightPlaceholder: 0,
      daysLogged: 0,
      periodStartWeight: 0,
      expectedEndWeight: 0,
      goalDirection: 'flat',
    },
  };
}

export function DashboardShell() {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const weekTitle = useMemo(() => getWeekTitle(), []);
  const emptyHeatmapData = useMemo(() => {
    const timezoneOffset = new Date().getTimezoneOffset();

    return buildCalorieAdherenceHeatmap({
      range: timeRange,
      dailyCalories: [],
      calorieTarget: null,
      timezoneOffset,
    });
  }, [timeRange]);
  const { data: weightSummary } = useWeightSummary(timeRange);

  const { data: verdict } = useQuery({
    queryKey: ['dashboard', 'verdict'],
    queryFn: getVerdictData,
    initialData: getVerdictData,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getStatsData,
    initialData: getStatsData,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const weightData = weightSummary?.weights ?? [];
  const periodStartWeight =
    weightSummary?.periodStartWeight ?? weightSummary?.currentWeight ?? 65;
  const expectedEndWeight =
    weightSummary?.expectedEndWeight ?? periodStartWeight;
  const goalDirection = weightSummary?.goalDirection ?? 'flat';

  const { data: heatmapData } = useQuery({
    queryKey: ['dashboard', 'heatmapData', timeRange],
    queryFn: () => {
      const timezoneOffset = new Date().getTimezoneOffset();

      return loadCalorieAdherenceHeatmap({
        range: timeRange,
        timezoneOffset,
      });
    },
    placeholderData: emptyHeatmapData,
    staleTime: 60_000,
  });

  const { data: nutrition } = useQuery({
    queryKey: ['dashboard', 'nutrition'],
    queryFn: getNutritionData,
    initialData: getNutritionData,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: meals } = useQuery({
    queryKey: ['dashboard', 'meals'],
    queryFn: getMealsToday,
    initialData: getMealsToday,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidateHeatmap = () => {
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'heatmapData'],
      });
    };

    const scheduleMidnightRefresh = () => {
      timer = setTimeout(() => {
        invalidateHeatmap();
        scheduleMidnightRefresh();
      }, getMsUntilNextLocalMidnight());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        invalidateHeatmap();
      }
    };

    const handleWindowFocus = () => {
      invalidateHeatmap();
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

  return (
    <main
      className="relative flex-1 overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Off-track banner removed — small badge next to Avg Daily Deficit is shown instead */}
      <div className="grid h-full grid-rows-[2fr_3fr_2fr] gap-2 overflow-y-auto px-5 pt-4 pb-3 sm:px-8">
        {/* ── Section 1: Current (week title) ── */}
        <section>
          <SectionHeader title={weekTitle} />
          <CurrentSection
            verdict={dashboard.verdict}
            stats={dashboard.stats}
            nutrition={dashboard.nutrition}
            weightSummary={dashboard.weightSummary}
          />
        </section>

        {/* ── Section 2: Progress ── */}
        <section className="flex min-h-0 flex-col">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
              {t('progress')}
            </span>
            {/* Time range toggle inline with header */}
            <div className="flex rounded-xl bg-nham-hover p-0.5">
              {(['30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    'rounded-lg px-3 py-1 font-medium text-[11px] transition-all',
                    timeRange === r
                      ? 'bg-card text-nham-text shadow-sm'
                      : 'text-nham-stone hover:text-nham-text-muted'
                  )}
                >
                  {r === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>
          </div>
          <ProgressSection
            weightChart={
              <WeightChart
                data={dashboard.weightSummary.weights}
                periodStartWeight={dashboard.weightSummary.periodStartWeight}
                expectedEndWeight={dashboard.weightSummary.expectedEndWeight}
                goalDirection={dashboard.weightSummary.goalDirection}
                range={timeRange}
              />
            }
            heatmap={
              <AdherenceHeatmap data={resolvedHeatmapData} range={timeRange} />
            }
          />
        </section>

        {/* ── Section 3: Today ── */}
        <section className="flex min-h-0 flex-col">
          <SectionHeader title={t('today')} delay={0.2} />
          <div className="flex-1">
            <TodaySection
              nutrition={dashboard.nutrition}
              meals={dashboard.meals}
            />
          </div>
        </section>
      </div>

      {/* Floating meal trigger — rendered at viewport level */}
      <MealTrigger />
    </main>
  );
}
