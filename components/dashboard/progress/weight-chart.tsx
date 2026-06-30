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
import type { TimeRange } from '@/lib/types/dashboard';
import { WeightChartTooltip } from './weight-chart-tooltip';
import { buildXTicks } from './weight-chart-utils';

interface WeightChartProps {
  data: number[];
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: 'up' | 'down' | 'flat';
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

const ACCENT = 'var(--nham-accent)';

export function WeightChart({
  data,
  periodStartWeight,
  expectedEndWeight,
  range,
  projectedEndWeight,
  canProject = false,
  periodElapsedDays,
}: WeightChartProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const yTicks = [periodStartWeight, expectedEndWeight].filter(
    (value, index, array) => array.indexOf(value) === index
  );

  const isSinglePoint = data.length === 1;
  const rangeDays = range === '30d' ? 30 : 90;
  const lastIndex = data.length - 1;

  // Forecast: dotted projection from the current weight to the projected end
  // weight. Logged weights are sparse (one point per logged day) and plotted by
  // position, so the forecast endpoint is extended *proportionally* into the
  // remaining period rather than to a fixed calendar day.
  const showForecast =
    canProject && typeof projectedEndWeight === 'number' && data.length >= 2;

  const elapsed =
    typeof periodElapsedDays === 'number' && periodElapsedDays > 0
      ? periodElapsedDays
      : lastIndex || 1;
  const forecastDay = showForecast
    ? lastIndex + (lastIndex * (rangeDays - elapsed)) / elapsed
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
      <div className="flex h-full min-h-[200px] items-center justify-center text-nham-stone text-sm">
        {t('noWeightData')}
      </div>
    );
  }

  // Y-axis clamped to goal range, expanding to fit data and the forecast endpoint.
  const goalTop = Math.max(periodStartWeight, expectedEndWeight);
  const goalBottom = Math.min(periodStartWeight, expectedEndWeight);
  const extremes = [
    ...data,
    ...(showForecast ? [projectedEndWeight as number] : []),
  ];
  const dataMin = Math.min(...extremes);
  const dataMax = Math.max(...extremes);
  const yMin = Math.min(goalBottom, dataMin) - 0.3;
  const yMax = Math.max(goalTop, dataMax) + 0.3;

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--nham-border)"
              strokeOpacity={0.6}
            />

            <XAxis
              dataKey="day"
              type="number"
              domain={[0, isSinglePoint ? rangeDays - 1 : forecastDay]}
              tickLine={false}
              axisLine={{ stroke: 'var(--nham-border)' }}
              tick={{ fontSize: 9, fill: 'var(--nham-stone)' }}
              ticks={xTicks}
              tickFormatter={(v: number, i: number) => xFormatter(v, i)}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickLine={false}
              axisLine={{ stroke: 'var(--nham-border)' }}
              tick={{ fontSize: 9, fill: 'var(--nham-stone)' }}
              ticks={yTicks}
              tickFormatter={(v: number) => v.toFixed(1)}
              width={36}
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
