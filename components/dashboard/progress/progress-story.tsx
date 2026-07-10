'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { CompactWeightLog } from '@/components/dashboard/current/compact-weight-log';
import { WeightChart } from '@/components/dashboard/progress/weight-chart';
import { buildWeightTrendSummary } from '@/lib/dashboard/weight-trend';
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
  const summary = useMemo(() => {
    if (!weightSummary) return null;

    return buildWeightTrendSummary({
      weights: weightSummary.weights,
      periodStartWeight: weightSummary.periodStartWeight,
      expectedEndWeight: weightSummary.expectedEndWeight,
      goalDirection: weightSummary.goalDirection,
      range,
      elapsedDays: weightSummary.periodElapsedDays,
    });
  }, [range, weightSummary]);

  if (!weightSummary || !summary) {
    return (
      <section className="flex min-h-[360px] flex-col rounded-[1.375rem] bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:h-full xl:min-h-0">
        <div className="flex flex-1 items-center justify-center text-nham-text-muted text-sm">
          {t('loadingWeightTrend')}
        </div>
      </section>
    );
  }

  const copy = t.raw(`progressStatus.${summary.status}`);
  const isInsufficient = summary.status === 'insufficient';
  const delta = summary.currentWeight - summary.startWeight;

  // ONE flat solid card: a single headline figure + a short status word, then
  // the chart. No nested tinted panels, no trend-arrow icon, no status pill,
  // no "now / projected" mini-boxes — the chart itself carries the projection.
  return (
    <section className="grid min-h-[320px] gap-3 rounded-[1.375rem] bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:h-full xl:min-h-0 xl:grid-cols-[minmax(220px,0.32fr)_minmax(0,0.68fr)]">
      <div className="flex min-h-0 flex-col gap-3 xl:content-start">
        <div>
          <h2 className="font-medium font-sans-display text-3xl text-nham-text tracking-[-0.04em]">
            {isInsufficient
              ? `${summary.currentWeight.toFixed(1)} ${t('units.kg')}`
              : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${t('units.kg')}`}
          </h2>
          <p className="mt-1 text-nham-text-muted text-sm">{copy.label}</p>
        </div>

        <CompactWeightLog
          currentWeight={weightSummary.currentWeight}
          todayWeight={weightSummary.todayWeight}
          todayDate={todayDate}
        />
      </div>

      <div className="min-h-[200px] xl:min-h-0">
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
