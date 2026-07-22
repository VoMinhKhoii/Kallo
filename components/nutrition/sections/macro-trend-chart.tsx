'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import type { DaySeriesBucketUnit } from '@/lib/nutrition/types';
import {
  buildMacroTrendAxis,
  COMPOSITION_COLORS,
  formatBucketLabel,
  type MacroTrendPoint,
} from './macro-trend-utils';

interface MacroTrendChartProps {
  points: MacroTrendPoint[];
  maxY: number;
  unit: DaySeriesBucketUnit;
}

/**
 * Stacked macro-calorie bars — the Flutter `MacroTrendChart` port. One rounded
 * column per bucket, split bottom→top into protein / carbs / fat kcal bands in
 * the warm macro tokens that match the `DaySummary` legend. Multi-day ranges
 * only; no tooltip.
 */
export function MacroTrendChart({ points, maxY, unit }: MacroTrendChartProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();

  const { topY, ticks } = buildMacroTrendAxis(maxY);
  // Fewer, fatter columns for the 7-day view; slimmer ones for the busier
  // 30-day (weekly) axis so they don't crowd.
  const barSize = points.length <= 7 ? 18 : 10;

  return (
    <div
      role="img"
      aria-label={t('rhythm.macroTrendAria')}
      className="mt-4 h-[248px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="4 4"
            stroke="var(--nham-border)"
          />

          <XAxis
            dataKey="index"
            interval={0}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--nham-text-muted)' }}
            tickFormatter={(_v, i) =>
              formatBucketLabel(points[i]?.startDate ?? '', unit, locale)
            }
          />
          <YAxis
            domain={[0, topY]}
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--nham-text-muted)' }}
            tickFormatter={(v: number) => String(Math.round(v))}
            width={36}
          />

          <Bar
            dataKey="protein"
            stackId="macros"
            fill={COMPOSITION_COLORS.protein}
            barSize={barSize}
            isAnimationActive={false}
          />
          <Bar
            dataKey="carbohydrate"
            stackId="macros"
            fill={COMPOSITION_COLORS.carbohydrate}
            barSize={barSize}
            isAnimationActive={false}
          />
          {/* Rounded top on the topmost band only. A bucket whose fat is 0 gets
              a square top instead (recharts applies the stacked radius to the
              fat rect, which has no height) — an accepted 4px cosmetic quirk. */}
          <Bar
            dataKey="fat"
            stackId="macros"
            fill={COMPOSITION_COLORS.fat}
            radius={[4, 4, 0, 0]}
            barSize={barSize}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
