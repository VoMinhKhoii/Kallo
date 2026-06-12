'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
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
  range: TimeRange;
}

export function WeightChart({
  data,
  periodStartWeight,
  expectedEndWeight,
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

  // Plan-path guide: a single dashed taupe line from the period's start weight
  // to its expected end weight. Deviation reads as distance from the guide — no
  // colored judgment zones, no danger reference line, no legend. (A maintenance
  // goal collapses to a flat guide at the start weight, which is still correct.)
  const lastDay = isSinglePoint ? rangeDays - 1 : data.length - 1;
  const planPathSegment = [
    { x: 0, y: periodStartWeight },
    { x: lastDay, y: expectedEndWeight },
  ];

  return (
    <div className="flex h-full min-h-[200px] flex-col">
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

            {/* Plan-path guide: where you'd be if you stayed on pace. */}
            <ReferenceLine
              segment={planPathSegment}
              stroke="var(--nham-text-muted)"
              strokeOpacity={0.45}
              strokeWidth={1.5}
              strokeDasharray="5 4"
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
