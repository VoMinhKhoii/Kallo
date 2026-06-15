'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ReferenceArea,
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
}

export function WeightChart({
  data,
  periodStartWeight,
  expectedEndWeight,
  goalDirection,
  range,
}: WeightChartProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const yTicks = [periodStartWeight, expectedEndWeight].filter(
    (value, index, array) => array.indexOf(value) === index
  );

  const isSinglePoint = data.length === 1;
  const rangeDays = range === '30d' ? 30 : 90;

  const chartData = useMemo(
    () =>
      isSinglePoint
        ? [{ day: 0, weight: data[0] }]
        : data.map((weight, i) => ({ day: i, weight })),
    [data, isSinglePoint]
  );

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

  // Y-axis clamped to goal range, expanding if data exceeds it
  const goalTop = Math.max(periodStartWeight, expectedEndWeight);
  const goalBottom = Math.min(periodStartWeight, expectedEndWeight);
  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  const yMin = Math.min(goalBottom, dataMin) - 0.3;
  const yMax = Math.max(goalTop, dataMax) + 0.3;

  // Off-track zone: above start weight (losing), below start weight (gaining), none for maintenance
  const offTrackTop =
    goalDirection === 'down'
      ? yMax
      : goalDirection === 'up'
        ? periodStartWeight
        : null;
  const offTrackBottom =
    goalDirection === 'down'
      ? periodStartWeight
      : goalDirection === 'up'
        ? yMin
        : null;

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      {/* Legend — off track only */}
      {goalDirection !== 'flat' && (
        <div className="mb-0.5 flex items-center gap-4 text-[10px] text-nham-stone">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-3 rounded-sm opacity-50"
              style={{ backgroundColor: 'var(--nham-danger)' }}
            />
            {t('offTrack')}
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--nham-accent)"
                  stopOpacity={0.18}
                />
                <stop
                  offset="100%"
                  stopColor="var(--nham-accent)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            {offTrackTop !== null && offTrackBottom !== null && (
              <ReferenceArea
                y1={offTrackBottom}
                y2={offTrackTop}
                fill="var(--nham-danger)"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            )}

            <XAxis
              dataKey="day"
              {...(isSinglePoint
                ? { type: 'number' as const, domain: [0, rangeDays - 1] }
                : {})}
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

            <ReferenceLine
              y={periodStartWeight}
              stroke="var(--nham-danger)"
              strokeOpacity={0.25}
              strokeWidth={1}
            />

            <Area
              type="monotone"
              dataKey="weight"
              stroke="var(--nham-accent)"
              strokeWidth={2}
              fill="url(#lineGrad)"
              fillOpacity={1}
              dot={
                isSinglePoint
                  ? {
                      r: 4,
                      fill: 'var(--nham-accent)',
                      stroke: 'white',
                      strokeWidth: 2,
                    }
                  : false
              }
              activeDot={{
                r: 4,
                fill: 'var(--nham-accent)',
                stroke: 'white',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
