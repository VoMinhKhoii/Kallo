'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useDailyMeals } from '@/hooks/use-daily-meals';
import { useWeightSummary } from '@/hooks/use-weight-summary';
import { loadCalorieAdherenceHeatmap, loadVerdictAction } from '@/lib/actions/dashboard';
import { buildCalorieAdherenceHeatmap } from '@/lib/dashboard/adherence';
import { getMsUntilNextLocalMidnight } from '@/lib/dashboard/heatmap-rollover';
import {
  buildTodayNutritionData,
  getTodayDateString,
  mapPersistedMealsToMealEntries,
} from '@/lib/dashboard/today';
import { cn } from '@/lib/utils';
import { CurrentSection } from './current/current-section';
import { getStatsData } from './mock-data';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { ProgressSection } from './progress/progress-section';
import { WeightChart } from './progress/weight-chart';
import { SectionHeader } from './section-header';
import { MealTrigger } from './today/meal-trigger';
import { TodaySection } from './today/today-section';
import type { TimeRange } from './types';

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

interface DashboardShellProps {
  profile: DashboardProfile;
}

export function DashboardShell({ profile }: DashboardShellProps) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [todayDate, setTodayDate] = useState(() => getTodayDateString());
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
    queryFn: () => loadVerdictAction({ timezoneOffset: new Date().getTimezoneOffset() }),
    staleTime: 60_000,
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
  const { data: persistedMeals = [] } = useDailyMeals(todayDate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidateHeatmap = () => {
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
        invalidateHeatmap();
        scheduleMidnightRefresh();
      }, getMsUntilNextLocalMidnight());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTodayDate();
        invalidateHeatmap();
      }
    };

    const handleWindowFocus = () => {
      syncTodayDate();
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
      className="relative flex-1 overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <div className="grid h-full grid-rows-[2fr_3fr_2fr] gap-2 overflow-y-auto px-5 pt-4 pb-3 sm:px-8">
        {/* ── Section 1: Current (week title) ── */}
        <section>
          <SectionHeader title={weekTitle} />
          {verdict && (
            <CurrentSection
              verdict={verdict}
              stats={getStatsData()}
              nutrition={todayNutrition}
              weightSummary={weightSummary}
            />
          )}
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
                data={weightData}
                periodStartWeight={periodStartWeight}
                expectedEndWeight={expectedEndWeight}
                goalDirection={goalDirection}
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
            <TodaySection nutrition={todayNutrition} meals={todayMeals} />
          </div>
        </section>
      </div>

      {/* Floating meal trigger — rendered at viewport level */}
      <MealTrigger />
    </main>
  );
}
