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

interface WeightChartProps {
  data: number[];
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: 'up' | 'down';
  range: TimeRange;
}

const OFF_TRACK_COLOR = '#D37B69';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function buildXTicks(
  count: number,
  range: TimeRange
): { ticks: number[]; formatter: (v: number, idx: number) => string } {
  if (range === '30d') {
    const step = Math.floor(count / 4);
    const ticks = [0, step, step * 2, step * 3, count - 1];
    return {
      ticks,
      formatter: (_v: number, idx: number) =>
        idx === ticks.length - 1 ? 'Now' : `W${idx + 1}`,
    };
  }

  // 90d — show months
  const today = new Date();
  const ticks: number[] = [];
  const labels: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const dayIndex = count - 1 - i * 30;
    ticks.push(Math.max(0, dayIndex));
    labels.push(MONTHS_SHORT[d.getMonth()]);
  }
  ticks.push(count - 1);
  labels.push('Now');
  return {
    ticks,
    formatter: (_v: number, idx: number) => labels[idx] ?? '',
  };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-nham-border/60 bg-card px-3 py-1.5 shadow-md">
      <span className="font-mono text-[12px] text-nham-text">
        {payload[0].value.toFixed(1)} kg
      </span>
    </div>
  );
}

export function WeightChart({
  data,
  periodStartWeight,
  expectedEndWeight,
  goalDirection,
  range,
}: WeightChartProps) {
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
        Not enough data yet
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

  // Off-track zone: above start weight (losing) or below start weight (gaining)
  const offTrackTop = goalDirection === 'down' ? yMax : periodStartWeight;
  const offTrackBottom = goalDirection === 'down' ? periodStartWeight : yMin;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Legend — off track only */}
      <div className="mb-1 flex items-center gap-4 text-[10px] text-nham-stone">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: OFF_TRACK_COLOR, opacity: 0.5 }}
          />
          Off track
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
          >
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A87C" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#C9A87C" stopOpacity={0} />
              </linearGradient>
            </defs>

            <ReferenceArea
              y1={offTrackBottom}
              y2={offTrackTop}
              fill={OFF_TRACK_COLOR}
              fillOpacity={0.08}
              strokeOpacity={0}
            />

            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: '#A8A29E' }}
              ticks={xTicks}
              tickFormatter={(v: number, i: number) => xFormatter(v, i)}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: '#A8A29E', fontFamily: 'monospace' }}
              ticks={[periodStartWeight, expectedEndWeight]}
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
              width={38}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={periodStartWeight}
              stroke={`${OFF_TRACK_COLOR}40`}
              strokeWidth={1}
            />

            <Area
              type="monotone"
              dataKey="weight"
              stroke="#C9A87C"
              strokeWidth={2}
              fill="url(#lineGrad)"
              fillOpacity={1}
              dot={false}
              activeDot={{
                r: 4,
                fill: '#C9A87C',
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
