'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDashboardDateRefresh } from '@/hooks/dashboard/use-dashboard-date-refresh';
import { useDashboardMealLog } from '@/hooks/dashboard/use-dashboard-meal-log';
import { useDashboardMeasurements } from '@/hooks/dashboard/use-dashboard-measurements';
import { useDashboardQueries } from '@/hooks/dashboard/use-dashboard-queries';
import { chooseRenderedHeatmapRange } from '@/lib/dashboard/heatmap-range';
import type {
  DashboardProfile,
  HeatmapRange,
  TimeRange,
} from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';
import { DashboardSectionState } from './dashboard-section-state';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { HeatmapSkeleton } from './progress/progress-section-skeleton';
import { ProgressStory } from './progress/progress-story';
import { FloatingMealTrigger, InlineMealTrigger } from './today/meal-trigger';
import { TodayDock } from './today/today-dock';

const RANGE_LABEL_KEYS: Record<HeatmapRange, string> = {
  '30d': 'ranges.thirtyDays',
  '90d': 'ranges.ninetyDays',
  year: 'ranges.year',
};

interface DashboardShellProps {
  profile: DashboardProfile;
}

export function DashboardShell({ profile }: DashboardShellProps) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const todayDate = useDashboardDateRefresh(queryClient);
  const {
    progressContainerRef,
    heatmapContainerRef,
    heatmapSize,
    hasMeasuredProgress,
    hasMeasuredHeatmap,
  } = useDashboardMeasurements();
  // Progress always covers a fixed 30-day window (matching the Flutter
  // dashboard's passive 30d range), regardless of viewport width.
  const weightRange: TimeRange = '30d';
  // Width alone picks the range: the consistency card is content-sized (its
  // row is `auto` at xl), so height never constrains the grid.
  const renderedHeatmapRange = heatmapSize
    ? chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: heatmapSize.width,
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
  // In-place meal logging: the input streams the AI analysis into the Today
  // card and auto-saves; the other sections step back while it runs.
  const { submit, streaming, restoredDraft } = useDashboardMealLog({
    userId: profile.userId,
    todayDate,
  });
  const dimClass = cn(
    'transition-[opacity,filter] duration-300',
    streaming.isActive && 'pointer-events-none opacity-50 saturate-[0.7]'
  );

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-kallo-surface/30 font-sans-display">
      {/* The xl layout fills the viewport with fr rows; when the viewport is
          too short for the rows' content minimums the page degrades to a
          gentle scroll (main is overflow-y-auto) instead of letting cards
          bleed over the section below. */}
      <div className="min-h-full px-3 py-3 pb-24 sm:px-5 sm:py-4 lg:px-8 xl:flex xl:flex-col xl:py-3 xl:pb-3">
        <div className="mx-auto grid w-full max-w-[1440px] gap-3 xl:flex-1 xl:grid-rows-[minmax(210px,250px)_minmax(260px,1fr)_auto]">
          <section className="flex min-h-0 flex-col gap-1.5">
            {/* The primary action — logging a meal — leads the page; the
                section header sits beneath it, over the Today card. The
                18px margin + the section's 6px gap = 24px below the bar,
                twice the 12px inter-card beat, so the input reads as its
                own zone. Mobile uses the FloatingMealTrigger instead. */}
            <div className="hidden md:mb-[18px] md:block">
              <InlineMealTrigger
                onSubmitMeal={submit}
                streaming={streaming}
                restoredDraft={restoredDraft}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-kallo-text-muted text-xs uppercase tracking-[0.08em]">
                {t('caloriesRemaining')}
              </span>
              <span className="font-medium text-kallo-text-muted text-xs">
                {t('today')}
              </span>
            </div>
            <div className="xl:min-h-0 xl:flex-1">
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
                  isStreaming={streaming.isActive}
                />
              )}
            </div>
          </section>

          <section
            ref={progressContainerRef}
            className={cn('flex min-w-0 flex-col gap-1.5 xl:min-h-0', dimClass)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-kallo-text-muted text-xs uppercase tracking-[0.08em]">
                {t('progress')}
              </span>
              <span className="font-medium text-kallo-text-muted text-xs">
                {t(RANGE_LABEL_KEYS[weightRange])}
              </span>
            </div>
            <div className="xl:min-h-0 xl:flex-1">
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

          <section className={cn('flex min-w-0 flex-col gap-1.5', dimClass)}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-kallo-text-muted text-xs uppercase tracking-[0.08em]">
                {t('consistency')}
              </span>
              <span className="font-medium text-kallo-text-muted text-xs">
                {t(RANGE_LABEL_KEYS[renderedHeatmapRange])}
              </span>
            </div>
            <div
              ref={heatmapContainerRef}
              className="min-h-[310px] rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-kallo-accent/50 hover:shadow-kallo-text/[0.06] hover:shadow-md sm:min-h-[340px] md:min-h-[360px] xl:min-h-0"
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

      <FloatingMealTrigger
        onSubmitMeal={submit}
        streaming={streaming}
        restoredDraft={restoredDraft}
      />
    </main>
  );
}
