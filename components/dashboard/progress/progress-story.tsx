'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
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

  const copy = t.raw(`progressStatus.${summary.status}`);
  const delta = summary.currentWeight - summary.startWeight;
  const Icon = delta <= 0 ? TrendingDown : TrendingUp;

  return (
    <section className="grid min-h-[500px] gap-2.5 rounded-[1.5rem] border border-nham-border/60 bg-card p-3 shadow-[0_10px_32px_rgba(44,36,22,0.05)] xl:h-full xl:min-h-0 xl:grid-cols-[minmax(240px,0.32fr)_minmax(0,0.68fr)] xl:p-3">
      <div className="grid min-h-0 gap-2.5 xl:grid-rows-[auto_1fr]">
        <div className="rounded-[1.25rem] bg-nham-surface/70 p-2.5">
          <div
            className={cn(
              'mb-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-semibold text-xs',
              summary.status === 'behind'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-nham-accent/10 text-nham-accent'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.label}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                className="font-semibold text-3xl text-nham-text tracking-[-0.04em]"
                style={{ fontFamily: 'Lora, serif' }}
              >
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)} {t('units.kg')}
              </h2>
              <p className="mt-1 text-nham-stone text-xs">{copy.detail}</p>
            </div>
            <div
              className={cn(
                'grid gap-2 text-sm',
                summary.canProject ? 'grid-cols-2' : 'grid-cols-1'
              )}
            >
              <div className="rounded-xl bg-card/80 px-2.5 py-2">
                <span className="block text-[9px] text-nham-stone uppercase tracking-[0.14em]">
                  {t('now')}
                </span>
                <strong className="font-mono text-nham-text text-xs">
                  {summary.currentWeight.toFixed(1)} {t('units.kg')}
                </strong>
              </div>
              {summary.canProject && (
                <div className="rounded-xl bg-card/80 px-2.5 py-2">
                  <span className="block text-[9px] text-nham-stone uppercase tracking-[0.14em]">
                    {t('projected')}
                  </span>
                  <strong className="font-mono text-nham-text text-xs">
                    {summary.projectedEndWeight.toFixed(1)} {t('units.kg')}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        <CompactWeightLog
          currentWeight={weightSummary.currentWeight}
          todayWeight={weightSummary.todayWeight}
          todayDate={todayDate}
        />
      </div>

      <div className="min-h-[220px] xl:min-h-0">
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
