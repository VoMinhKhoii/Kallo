'use client';

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
import type { TimeRange } from '@/components/dashboard/types';
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
  const yTicks = [periodStartWeight, expectedEndWeight].filter(
    (value, index, array) => array.indexOf(value) === index
  );

  const chartData = useMemo(
    () => data.map((weight, i) => ({ day: i, weight })),
    [data]
  );

  const { ticks: xTicks, formatter: xFormatter } = useMemo(
    () => buildXTicks(data.length, range),
    [data.length, range]
  );

  if (data.length < 2) {
    return (
      <div className="flex flex-1 items-center justify-center text-nham-stone text-sm">
        Log your weight for at least 2 days to see your trend
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Legend — off track only */}
      {goalDirection !== 'flat' && (
        <div className="mb-1 flex items-center gap-4 text-[10px] text-nham-stone">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-3 rounded-sm opacity-50"
              style={{ backgroundColor: 'var(--nham-danger)' }}
            />
            Off track
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
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
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'var(--nham-stone)' }}
              ticks={xTicks}
              tickFormatter={(v: number, i: number) => xFormatter(v, i)}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 9,
                fill: 'var(--nham-stone)',
                fontFamily: 'monospace',
              }}
              ticks={yTicks}
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
              width={38}
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
              dot={false}
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
