'use client';

import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

interface SparklineProps {
  data: { date: string; count: number }[];
}

export function Sparkline({ data }: SparklineProps) {
  // Per-instance gradient id. `linearGradient` ids resolve at document scope,
  // so two Sparklines on the same page would otherwise both reference the
  // first SVG's gradient. useId() gives us a stable, collision-free id.
  const reactId = useId();
  const gradientId = `sparkGradient-${reactId.replace(/:/g, '')}`;

  if (data.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center text-muted-foreground text-xs">
        No data
      </div>
    );
  }

  const counts = data.map((point) => point.count);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const latest = data.at(-1);
  const summary = `Requests per day for the last 30 days: ${total} total, minimum ${min}, maximum ${max}, latest ${latest?.count ?? 0} on ${latest?.date ?? 'unknown date'}.`;

  // role=img + aria-label is an atomic accessible name; no inner sr-only
  // paragraph (VoiceOver double-announces if both are present).
  return (
    <div aria-label={summary} role="img">
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={64}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip
              contentStyle={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
              labelFormatter={(label) => label}
              formatter={(value: number) => [value, 'requests']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
