'use client';

import { useTranslations } from 'next-intl';
import { getHeatmapColor } from '@/components/dashboard/progress/heatmap-colors';
import type {
  DaySeriesBucketUnit,
  NutrientDaySeries,
} from '@/lib/nutrition/types';

interface DayStripProps {
  series: NutrientDaySeries;
  unit: DaySeriesBucketUnit;
  /** Localized macro/nutrient name for the strip's accessible label. */
  label: string;
}

/**
 * One nutrient's per-bucket time axis: a strip of cells colored on the warm
 * heatmap scale (distance from target), with a min–max whisker band beneath.
 * Gap buckets (no complete log) read as an empty track cell, never zero.
 */
export function DayStrip({ series, unit, label }: DayStripProps) {
  const t = useTranslations('nutrition.rhythm.timeAxis');
  const bucketWord = unit === 'day' ? t('bucketDay') : t('bucketWeek');

  // Whisker band spans the metric's min→max as a fraction of the cell scale.
  // Anchored on target (ratio 1.0 → center) when a target exists, else on the
  // observed range so the band still communicates spread.
  const hasTarget = series.target !== null && series.target > 0;
  const { min, max } = series;
  const span = max !== null && min !== null ? max - min : 0;

  return (
    <div className="space-y-1.5">
      <div
        role="img"
        aria-label={
          min !== null && max !== null
            ? t('stripAria', {
                macro: label,
                bucket: bucketWord,
                low: Math.round(min),
                high: Math.round(max),
                unit: series.unit,
              })
            : label
        }
        className="flex gap-0.5"
      >
        {series.buckets.map((bucket) => {
          const isGap = bucket.value === null;
          const { bg } = getHeatmapColor(
            hasTarget ? bucket.ratioOfTarget : isGap ? null : 1
          );
          return (
            <span
              key={bucket.startDate}
              title={
                isGap
                  ? t('gap')
                  : `${bucket.startDate}: ${Math.round(bucket.value ?? 0)} ${series.unit}`
              }
              className="h-5 flex-1 rounded-[3px]"
              style={{
                backgroundColor: isGap ? 'var(--nham-track)' : bg,
                opacity: isGap ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>

      {min !== null && max !== null && span > 0 ? (
        <div className="flex items-center gap-2">
          <span className="relative h-1 flex-1 rounded-full bg-nham-track">
            <span
              className="absolute inset-y-0 rounded-full bg-nham-accent/50"
              style={{
                left: `${hasTarget && series.target ? clampPct(min / (series.target * 2)) : 0}%`,
                right: `${hasTarget && series.target ? 100 - clampPct(max / (series.target * 2)) : 0}%`,
              }}
            />
          </span>
          <span className="shrink-0 text-[10px] text-nham-text-muted tabular-nums">
            {t('rangeLabel', {
              low: Math.round(min),
              high: Math.round(max),
              unit: series.unit,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function clampPct(fraction: number): number {
  return Math.max(0, Math.min(100, fraction * 100));
}
