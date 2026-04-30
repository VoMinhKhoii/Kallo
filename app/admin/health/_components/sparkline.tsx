'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

interface SparklineProps {
  data: { date: string; count: number }[];
}

export function Sparkline({ data }: SparklineProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center text-muted-foreground text-xs">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
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
          fill="url(#sparkGradient)"
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
