'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyMeals } from '@/hooks/use-daily-meals';
import { useWeightSummary } from '@/hooks/use-weight-summary';
import {
  loadCalorieAdherenceHeatmap,
  loadVerdictAction,
} from '@/lib/actions/dashboard';
import { buildCalorieAdherenceHeatmap } from '@/lib/dashboard/adherence';
import { getMsUntilNextLocalMidnight } from '@/lib/dashboard/heatmap-rollover';
import {
  buildTodayNutritionData,
  getTodayDateString,
  mapPersistedMealsToMealEntries,
} from '@/lib/dashboard/today';
import { cn } from '@/lib/utils';
import { CurrentSection } from './current/current-section';
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

function CurrentSectionSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard summary"
      className="flex items-stretch gap-5"
    >
      <div className="flex shrink-0 flex-col rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-1 h-3 w-28 rounded-full bg-nham-track" />
        <Skeleton className="h-[84px] w-[168px] rounded-2xl bg-nham-track" />
      </div>

      <div className="flex shrink-0 items-start gap-4">
        <div className="flex h-full flex-col gap-2 rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
          <Skeleton className="h-3 w-24 rounded-full bg-nham-track" />
          <Skeleton className="h-[76px] w-[138px] rounded-xl bg-nham-track" />
        </div>
        <div className="mt-3 h-full w-px self-stretch bg-nham-border/40" />
        <div className="flex h-full flex-col gap-2 rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
          <Skeleton className="h-3 w-28 rounded-full bg-nham-track" />
          <Skeleton className="h-7 w-24 rounded-full bg-nham-track" />
          <Skeleton className="h-3 w-32 rounded-full bg-nham-track" />
        </div>
      </div>

      <div className="flex-1" />

      <div className="w-[340px] shrink-0 rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
        <Skeleton className="mb-2 h-3 w-24 rounded-full bg-nham-track" />
        <Skeleton className="h-[120px] w-full rounded-xl bg-nham-track" />
      </div>
    </div>
  );
}

function ProgressSectionSkeleton({ range }: { range: TimeRange }) {
  const heatmapSquares = range === '30d' ? 35 : 70;

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
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [todayDate, setTodayDate] = useState(() => getTodayDateString());
  const verdictErrorShown = useRef(false);
  const heatmapErrorShown = useRef(false);
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

  const verdictQuery = useQuery({
    queryKey: ['dashboard', 'verdict'],
    queryFn: () =>
      loadVerdictAction({ timezoneOffset: new Date().getTimezoneOffset() }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!verdictQuery.isError) {
      verdictErrorShown.current = false;
      return;
    }

    if (verdictErrorShown.current) return;

    verdictErrorShown.current = true;
    console.error('[dashboard] verdict query failed', verdictQuery.error);
    toast.error('Unable to load the Current section. Please try again.');
  }, [verdictQuery.error, verdictQuery.isError]);

  const verdict = verdictQuery.data;

  const weightData = weightSummary?.weights ?? [];
  const periodStartWeight =
    weightSummary?.periodStartWeight ?? weightSummary?.currentWeight ?? 65;
  const expectedEndWeight =
    weightSummary?.expectedEndWeight ?? periodStartWeight;
  const goalDirection = weightSummary?.goalDirection ?? 'flat';
  const stats = verdict
    ? {
        streak: weightSummary?.daysLogged ?? 0,
        daysLogged: weightSummary?.daysLogged ?? 0,
        avgDeficit: Math.round((-verdict.weeklyRate * 7700) / 7),
        todayWeight: weightSummary?.todayWeight ?? null,
        weightPlaceholder:
          weightSummary?.weightPlaceholder ?? verdict.currentWeight,
      }
    : undefined;

  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'heatmapData', timeRange],
    queryFn: () => {
      const timezoneOffset = new Date().getTimezoneOffset();

      return loadCalorieAdherenceHeatmap({
        range: timeRange,
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

  const heatmapData = heatmapQuery.data;
  const { data: persistedMeals = [] } = useDailyMeals(todayDate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidateDashboardQueries = () => {
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'heatmapData'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'verdict'],
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
      className="relative flex-1 overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <div className="grid h-full grid-rows-[2fr_3fr_2fr] gap-2 overflow-y-auto px-5 pt-4 pb-3 sm:px-8">
        {/* ── Section 1: Current (week title) ── */}
        <section>
          <SectionHeader title={weekTitle} />
          {!verdict || !stats ? (
            <CurrentSectionSkeleton />
          ) : (
            <CurrentSection
              verdict={verdict}
              stats={stats}
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
          {!heatmapData ? (
            <ProgressSectionSkeleton range={timeRange} />
          ) : (
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
                <AdherenceHeatmap
                  data={resolvedHeatmapData}
                  range={timeRange}
                />
              }
            />
          )}
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
