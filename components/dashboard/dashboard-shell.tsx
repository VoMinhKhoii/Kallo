'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CurrentSection } from './current/current-section';
import {
  getHeatmapData,
  getMealsToday,
  getNutritionData,
  getStatsData,
  getVerdictData,
  getWeightChartMeta,
  getWeightData,
} from './mock-data';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { ProgressSection } from './progress/progress-section';
import { WeightChart } from './progress/weight-chart';
import { SectionHeader } from './section-header';
import { MealTrigger } from './today/meal-trigger';
import { TodaySection } from './today/today-section';
import type { TimeRange } from './types';

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

export function DashboardShell() {
  const t = useTranslations('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const weekTitle = useMemo(() => getWeekTitle(), []);

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

  const { data: weightData } = useQuery({
    queryKey: ['dashboard', 'weightData', timeRange],
    queryFn: () => getWeightData(timeRange),
    initialData: () => getWeightData(timeRange),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: weightChartMeta } = useQuery({
    queryKey: ['dashboard', 'weightChartMeta', timeRange],
    queryFn: () => getWeightChartMeta(timeRange),
    initialData: () => getWeightChartMeta(timeRange),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: heatmapData } = useQuery({
    queryKey: ['dashboard', 'heatmapData', timeRange],
    queryFn: () => getHeatmapData(timeRange),
    initialData: () => getHeatmapData(timeRange),
    staleTime: Number.POSITIVE_INFINITY,
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

  const { periodStartWeight, expectedEndWeight, goalDirection } =
    weightChartMeta;

  return (
    <main
      className="relative flex-1 overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <div className="grid h-full grid-rows-[2fr_3fr_2fr] gap-2 overflow-y-auto px-5 pt-4 pb-3 sm:px-8">
        {/* ── Section 1: Current (week title) ── */}
        <section>
          <SectionHeader title={weekTitle} />
          <CurrentSection
            verdict={verdict}
            stats={stats}
            nutrition={nutrition}
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
                data={weightData}
                periodStartWeight={periodStartWeight}
                expectedEndWeight={expectedEndWeight}
                goalDirection={goalDirection}
                range={timeRange}
              />
            }
            heatmap={<AdherenceHeatmap data={heatmapData} range={timeRange} />}
          />
        </section>

        {/* ── Section 3: Today ── */}
        <section className="flex min-h-0 flex-col">
          <SectionHeader title={t('today')} delay={0.2} />
          <div className="flex-1">
            <TodaySection nutrition={nutrition} meals={meals} />
          </div>
        </section>
      </div>

      {/* Floating meal trigger — rendered at viewport level */}
      <MealTrigger />
    </main>
  );
}
