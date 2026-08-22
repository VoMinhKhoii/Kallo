'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimeRange } from '@/lib/core/types/dashboard';
import { WeightChartTooltip } from './weight-chart-tooltip';
import { buildXTicks } from './weight-chart-utils';

interface WeightChartProps {
  data: number[];
  range: TimeRange;
  projectedEndWeight?: number;
  canProject?: boolean;
  periodElapsedDays?: number | null;
}

interface ChartPoint {
  day: number;
  actual: number | null;
  forecast: number | null;
}

const ACCENT = 'var(--kallo-accent)';

export function WeightChart({
  data,
  range,
  projectedEndWeight,
  canProject = false,
  periodElapsedDays,
}: WeightChartProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');

  const isSinglePoint = data.length === 1;
  const rangeDays = range === '30d' ? 30 : 90;
  const lastIndex = data.length - 1;

  // Forecast: dotted projection from the current weight to the projected end
  // weight. Logged weights are sparse (one point per logged day) and plotted by
  // position, so the forecast endpoint is extended *proportionally* into the
  // remaining period rather than to a fixed calendar day.
  // `canProject` already implies ≥3 logged points (see buildWeightTrendSummary);
  // the typeof guard is only for the optional prop.
  const showForecast = canProject && typeof projectedEndWeight === 'number';

  const elapsed =
    typeof periodElapsedDays === 'number' && periodElapsedDays > 0
      ? periodElapsedDays
      : lastIndex || 1;
  // Cap the forecast tail so the logged data always spans ≥80% of the width
  // (a short dotted tail) instead of being squashed when the period is early.
  const forecastDay = showForecast
    ? Math.min(
        lastIndex + (lastIndex * (rangeDays - elapsed)) / elapsed,
        lastIndex / 0.8
      )
    : lastIndex;

  const chartData = useMemo<ChartPoint[]>(() => {
    const points: ChartPoint[] = data.map((weight, i) => ({
      day: i,
      actual: weight,
      forecast: null,
    }));
    if (showForecast && points.length > 0) {
      // Anchor the forecast at the current point, then extend it forward.
      points[lastIndex].forecast = data[lastIndex];
      points.push({
        day: forecastDay,
        actual: null,
        forecast: projectedEndWeight as number,
      });
    }
    return points;
  }, [data, forecastDay, lastIndex, projectedEndWeight, showForecast]);

  const { ticks: xTicks, formatter: xFormatter } = useMemo(() => {
    if (isSinglePoint) {
      return {
        ticks: [0],
        formatter: () => t('start'),
      };
    }
    return buildXTicks(data.length, range, locale, t('now'), t('weekPrefix'));
  }, [isSinglePoint, data.length, range, locale, t]);

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-kallo-text-muted text-sm xl:min-h-0">
        {t('noWeightData')}
      </div>
    );
  }

  // Uniform, round-number Y axis fitted to the data (+ forecast endpoint): pick
  // a step that yields a few evenly spaced gridlines, snap the bounds outward to
  // whole steps, then emit a tick at every step (mirrors the mobile chart).
  const extremes = [
    ...data,
    ...(showForecast ? [projectedEndWeight as number] : []),
  ];
  const rawMin = Math.min(...extremes);
  const rawMax = Math.max(...extremes);
  const span = Math.max(rawMax - rawMin, 0.5);
  const yStep = span <= 2 ? 0.5 : span <= 5 ? 1 : span <= 12 ? 2 : 5;
  let yMin = Math.floor(rawMin / yStep) * yStep;
  let yMax = Math.ceil(rawMax / yStep) * yStep;
  if (yMax - yMin < yStep * 1.5) {
    yMin -= yStep;
    yMax += yStep;
  }
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) {
    yTicks.push(Number(v.toFixed(2)));
  }

  return (
    <div className="flex h-full min-h-[200px] flex-col xl:min-h-0">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            // Numbers live in the YAxis gutter on the left; the plot fills to the
            // right edge (small right margin so the last label isn't clipped).
            margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--kallo-border)"
              strokeOpacity={0.6}
            />

            <XAxis
              dataKey="day"
              type="number"
              domain={[0, isSinglePoint ? rangeDays - 1 : forecastDay]}
              tickLine={false}
              axisLine={{ stroke: 'var(--kallo-border)' }}
              tick={{ fontSize: 12, fill: 'var(--kallo-text-muted)' }}
              ticks={xTicks}
              tickFormatter={(v: number, i: number) => xFormatter(v, i)}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--kallo-text-muted)' }}
              tickFormatter={(v: number) =>
                yStep >= 1 ? v.toFixed(0) : v.toFixed(1)
              }
              width={26}
            />

            <Tooltip content={<WeightChartTooltip />} />

            {/* Forecast — dotted projection toward the period end */}
            {showForecast && (
              <Line
                type="linear"
                dataKey="forecast"
                stroke={ACCENT}
                strokeOpacity={0.6}
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* "Today" marker at the most recent logged weight */}
            <ReferenceLine
              x={lastIndex}
              stroke={ACCENT}
              strokeOpacity={0.35}
              strokeWidth={1}
            />

            {/* Actual weight — straight segments with a dot at every point */}
            <Line
              type="linear"
              dataKey="actual"
              stroke={ACCENT}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, index, key } = props;
                if (cx == null || cy == null) return <g key={key} />;
                const isLast = index === lastIndex;
                if (isLast) {
                  return (
                    <g key={key}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={9}
                        fill={ACCENT}
                        opacity={0.18}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill={ACCENT}
                        stroke="white"
                        strokeWidth={2}
                      />
                    </g>
                  );
                }
                return (
                  <circle
                    key={key}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={ACCENT}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{
                r: 4.5,
                fill: ACCENT,
                stroke: 'white',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
