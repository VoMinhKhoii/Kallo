'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { CompactWeightLog } from '@/components/dashboard/current/compact-weight-log';
import { WeightChart } from '@/components/dashboard/progress/weight-chart';
import { buildWeightTrendSummary } from '@/lib/dashboard/weight-trend';
import type { TimeRange } from '@/lib/types/dashboard';
import type { WeightSummaryData } from '@/lib/types/weight';
import { cn } from '@/lib/utils';

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
      <section className="flex min-h-[420px] flex-col rounded-[1.5rem] border border-nham-border/60 bg-card p-4 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:h-full xl:min-h-0">
        <div className="flex flex-1 items-center justify-center text-nham-stone text-sm">
          {t('loadingWeightTrend')}
        </div>
      </section>
    );
  }

  const isInsufficient = summary.status === 'insufficient';
  const delta = summary.currentWeight - summary.startWeight;
  // A minus sign is a real minus, not a hyphen; the kg delta reads as the
  // period's change. Direction and pace are read from the chart's guide line
  // below — no pill, no trend arrow, no written verdict.
  const deltaLabel = `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(
    delta
  ).toFixed(1)} ${t('units.kg')}`;

  return (
    <section className="grid min-h-[360px] gap-2 rounded-[1.5rem] border border-nham-border/60 bg-card p-2.5 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:h-full xl:min-h-0 xl:grid-cols-[minmax(240px,0.32fr)_minmax(0,0.68fr)]">
      <div className="grid min-h-0 gap-2 xl:grid-rows-[auto_auto] xl:content-start">
        <div className="rounded-[1.25rem] bg-nham-surface p-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                className="font-normal text-3xl text-nham-text tracking-[-0.04em]"
                style={{ fontFamily: 'Lora, serif' }}
              >
                {isInsufficient
                  ? `${summary.currentWeight.toFixed(1)} ${t('units.kg')}`
                  : deltaLabel}
              </h2>
            </div>
            {!isInsufficient && (
              <div
                className={cn(
                  'grid gap-2 text-sm',
                  summary.canProject ? 'grid-cols-2' : 'grid-cols-1'
                )}
              >
                <div className="rounded-xl bg-card px-2.5 py-2">
                  <span className="block text-[9px] text-nham-stone uppercase tracking-[0.15em]">
                    {t('now')}
                  </span>
                  <strong className="font-mono text-nham-text text-xs">
                    {summary.currentWeight.toFixed(1)} {t('units.kg')}
                  </strong>
                </div>
                {summary.canProject && (
                  <div className="rounded-xl bg-card px-2.5 py-2">
                    <span className="block text-[9px] text-nham-stone uppercase tracking-[0.15em]">
                      {t('projected')}
                    </span>
                    <strong className="font-mono text-nham-text text-xs">
                      {summary.projectedEndWeight.toFixed(1)} {t('units.kg')}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
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
          periodStartWeight={weightSummary.periodStartWeight}
          expectedEndWeight={weightSummary.expectedEndWeight}
          goalDirection={weightSummary.goalDirection}
          range={range}
        />
      </div>
    </section>
  );
}
