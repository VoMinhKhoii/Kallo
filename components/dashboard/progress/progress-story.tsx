'use client';

import { useTranslations } from 'next-intl';
import { WeightChart } from '@/components/dashboard/progress/weight-chart';
import { WeightLogPopover } from '@/components/dashboard/progress/weight-log-popover';
import type { TimeRange } from '@/lib/types/dashboard';
import type { WeightSummaryData } from '@/lib/types/weight';

interface ProgressStoryProps {
  weightSummary: WeightSummaryData | undefined;
  range: TimeRange;
  todayDate: string;
}

export function ProgressStory({
  weightSummary,
  range,
  todayDate,
}: ProgressStoryProps) {
  const t = useTranslations('dashboard');

  if (!weightSummary) {
    return (
      <section className="flex min-h-[320px] flex-col rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-kallo-accent/50 hover:shadow-kallo-text/[0.06] hover:shadow-md xl:h-full xl:min-h-0">
        <div className="flex flex-1 items-center justify-center text-kallo-text-muted text-sm">
          {t('loadingWeightTrend')}
        </div>
      </section>
    );
  }

  // Net change over the window (current − period start), shown as a small
  // text-arrow badge beside the hero number — mirrors the Flutter card.
  const delta = weightSummary.currentWeight - weightSummary.periodStartWeight;
  const hasTrend = weightSummary.weights.length > 1 && Math.abs(delta) >= 0.05;

  // ONE flat solid card (the Flutter WeightChart redesign): the current weight
  // as the hero with a small net-change badge and a "Log weight" popover
  // affordance, then the full-width chart. No resident form, no status copy —
  // the chart itself carries the story.
  return (
    <section className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-kallo-accent/50 hover:shadow-kallo-text/[0.06] hover:shadow-md xl:h-full xl:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <h2 className="font-sans-display text-hero text-kallo-text tabular-nums">
            {weightSummary.currentWeight.toFixed(1)}
          </h2>
          <span className="text-kallo-text-muted text-sm">{t('units.kg')}</span>
          {hasTrend && (
            <span className="ml-1 font-medium text-kallo-text-muted text-sm tabular-nums">
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
        <WeightLogPopover
          currentWeight={weightSummary.currentWeight}
          todayWeight={weightSummary.todayWeight}
          todayDate={todayDate}
        />
      </div>

      {/* Below xl the card is content-sized, which gives Recharts'
          ResponsiveContainer no definite height to measure (it collapses on
          mobile and balloons mid-width) — so the chart gets a fixed height
          there and only fills the row at xl, where the height is definite. */}
      <div className="h-[220px] shrink-0 xl:h-auto xl:min-h-0 xl:flex-1">
        <WeightChart
          data={weightSummary.weights}
          range={range}
          projectedEndWeight={weightSummary.projectedEndWeight}
          canProject={weightSummary.canProject}
          periodElapsedDays={weightSummary.periodElapsedDays}
        />
      </div>
    </section>
  );
}
