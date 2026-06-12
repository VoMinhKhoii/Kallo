'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  chooseDataAgeRange,
  chooseRenderedHeatmapRange,
} from '@/lib/dashboard/heatmap-range';
import type {
  DashboardProfile,
  HeatmapRange,
  TimeRange,
} from '@/lib/types/dashboard';
import { DashboardSectionState } from './dashboard-section-state';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { HeatmapSkeleton } from './progress/progress-section-skeleton';
import { ProgressStory } from './progress/progress-story';
import { SectionHeader } from './section-header';
import { FloatingMealTrigger } from './today/meal-trigger';
import { TodayDock } from './today/today-dock';
import { useDashboardDateRefresh } from './use-dashboard-date-refresh';
import { useDashboardMeasurements } from './use-dashboard-measurements';
import { useDashboardQueries } from './use-dashboard-queries';

function getWeekTitle(locale: string, label: string, today: string): string {
  const now = new Date(today);
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  });
  const year = sunday.getFullYear();

  return `${label} ${formatter.format(monday)} – ${formatter.format(sunday)}, ${year}`;
}

const RANGE_LABEL_KEYS: Record<HeatmapRange, string> = {
  '30d': 'ranges.thirtyDays',
  '90d': 'ranges.ninetyDays',
  year: 'ranges.year',
};

interface DashboardShellProps {
  profile: DashboardProfile;
  /** UTC date of the user's first logged meal, or null if they've logged none. */
  firstMealDate: string | null;
}

export function DashboardShell({
  profile,
  firstMealDate,
}: DashboardShellProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const todayDate = useDashboardDateRefresh(queryClient);
  const {
    progressContainerRef,
    heatmapContainerRef,
    progressWidth,
    heatmapSize,
    hasMeasuredProgress,
    hasMeasuredHeatmap,
  } = useDashboardMeasurements();
  const weekTitle = useMemo(
    () => getWeekTitle(locale, t('weekOf'), todayDate),
    [locale, t, todayDate]
  );
  const weightRange: TimeRange =
    progressWidth !== null && progressWidth >= 620 ? '90d' : '30d';
  // Stage by data age first (a new user shouldn't face an empty year grid),
  // then let the size chooser cap it so the earned range still fits the
  // viewport. The two compose: data age picks the ceiling, size lowers it.
  const dataAgeRange = chooseDataAgeRange(firstMealDate, todayDate);
  const renderedHeatmapRange = heatmapSize
    ? chooseRenderedHeatmapRange({
        preferredRange: dataAgeRange,
        availableWidth: heatmapSize.width,
        availableHeight: heatmapSize.height,
        weekCount: { '30d': 5, '90d': 14, year: 53 },
      })
    : '30d';
  const {
    dailyMealsQuery,
    heatmapData,
    heatmapQuery,
    resolvedHeatmapData,
    todayMeals,
    todayNutrition,
    weekly,
    weightSummary,
    weightSummaryQuery,
  } = useDashboardQueries({
    todayDate,
    profile,
    weightRange,
    heatmapRange: renderedHeatmapRange,
    hasMeasuredProgress,
    hasMeasuredHeatmap,
    heatmapLoadErrorMessage: t('heatmapLoadError'),
  });

  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-nham-surface"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Un-inverted: a scrolling page, not a no-scroll cockpit. Tier 1 is a
          generous Today band (full width at every breakpoint); Tier 2 is
          Progress + Consistency at 50/50 on large screens, stacked below. */}
      <div className="px-3 py-4 pb-24 sm:px-5 sm:py-5 lg:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-5 sm:gap-6">
          <section className="flex flex-col gap-2">
            <SectionHeader title={weekTitle} />
            <div>
              {dailyMealsQuery.isPending ? (
                <DashboardSectionState message={t('todayLoading')} />
              ) : dailyMealsQuery.isError ? (
                <DashboardSectionState
                  message={t('todayLoadError')}
                  actionLabel={t('retry')}
                  onAction={() => {
                    void dailyMealsQuery.refetch();
                  }}
                />
              ) : (
                <TodayDock
                  nutrition={todayNutrition}
                  meals={todayMeals}
                  weekly={weekly}
                  isFirstRun={firstMealDate === null}
                />
              )}
            </div>
          </section>

          <div className="grid gap-5 sm:gap-6 xl:grid-cols-2">
            <section
              ref={progressContainerRef}
              className="flex min-w-0 flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
                  {t('progress')}
                </span>
                <span className="font-medium text-[11px] text-nham-stone">
                  {t(RANGE_LABEL_KEYS[weightRange])}
                </span>
              </div>
              <div>
                {!hasMeasuredProgress || weightSummaryQuery.isPending ? (
                  <ProgressStory
                    weightSummary={undefined}
                    range={weightRange}
                    todayDate={todayDate}
                  />
                ) : weightSummaryQuery.isError ? (
                  <DashboardSectionState
                    message={t('progressLoadError')}
                    actionLabel={t('retry')}
                    onAction={() => {
                      void weightSummaryQuery.refetch();
                    }}
                  />
                ) : (
                  <ProgressStory
                    weightSummary={weightSummary}
                    range={weightRange}
                    todayDate={todayDate}
                  />
                )}
              </div>
            </section>

            <section className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-[12px] text-nham-stone uppercase tracking-[0.2em]">
                  {t('consistency')}
                </span>
                <span className="font-medium text-[11px] text-nham-stone">
                  {t(RANGE_LABEL_KEYS[renderedHeatmapRange])}
                </span>
              </div>
              <div
                ref={heatmapContainerRef}
                className="min-h-[310px] rounded-[1.5rem] border border-nham-border/60 bg-card p-3 shadow-[0_10px_32px_rgba(44,36,22,0.05)] sm:min-h-[340px] md:min-h-[360px] xl:p-4"
              >
                {!hasMeasuredHeatmap || heatmapQuery.isPending ? (
                  <HeatmapSkeleton range={renderedHeatmapRange} />
                ) : heatmapQuery.isError ? (
                  <DashboardSectionState
                    message={t('heatmapLoadError')}
                    actionLabel={t('retry')}
                    onAction={() => {
                      void heatmapQuery.refetch();
                    }}
                  />
                ) : !heatmapData ? (
                  <HeatmapSkeleton range={renderedHeatmapRange} />
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
      </div>

      <FloatingMealTrigger />
    </main>
  );
}
