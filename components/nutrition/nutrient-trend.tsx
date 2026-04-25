'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { NutrientTrend as NutrientTrendData } from '@/lib/nutrition/types';

interface NutrientTrendProps {
  trend: NutrientTrendData;
  unit: string;
}

function formatValue(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

export function NutrientTrend({ trend, unit }: NutrientTrendProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();
  const visiblePoints = trend.points.slice(-7);

  if (trend.displayMode === 'insufficient_data') {
    return (
      <p className="text-nham-text-muted text-sm">
        {t('trend.insufficientData')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-nham-text-muted text-xs">
        {trend.displayMode === 'points'
          ? t('trend.pointMode')
          : t('trend.lineMode')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {visiblePoints.map((point) => (
          <div
            key={point.date}
            className="flex items-center justify-between gap-3 rounded-xl bg-nham-hover/45 px-3 py-2"
          >
            <span className="min-w-0 truncate text-nham-text-muted text-xs">
              {point.date}
            </span>
            <span className="font-medium text-nham-text text-xs tabular-nums">
              {point.value === null
                ? t('trend.noDataPoint')
                : `${formatValue(point.value, locale)} ${unit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
