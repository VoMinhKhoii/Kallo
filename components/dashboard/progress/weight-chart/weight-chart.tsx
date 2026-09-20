'use client';

import { useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimeRange } from '@/lib/core/types/dashboard';
import { makeReadingDot } from './weight-chart-dot';
import { WeightChartTooltip } from './weight-chart-tooltip';
import {
  buildWeightPlot,
  makeDayLabeller,
  yAxisGutter,
} from './weight-chart-utils';

interface WeightChartProps {
  data: number[];
  /** `YYYY-MM-DD` logged dates, parallel to `data`. */
  weightDates: string[];
  range: TimeRange;
  projectedEndWeight?: number;
  canProject?: boolean;
  periodElapsedDays?: number | null;
  /** Anchors the Y band when nothing is logged yet. */
  weightPlaceholder: number;
}

const ACCENT = 'var(--kallo-accent)';
/** Dots are ringed in the card they sit on, so the ring reads in either theme. */
const RING = 'var(--card)';

export function WeightChart({
  data,
  weightDates,
  range,
  projectedEndWeight,
  canProject = false,
  periodElapsedDays,
  weightPlaceholder,
}: WeightChartProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const reduceMotion = useReducedMotion();

  const rangeDays = range === '30d' ? 30 : 90;

  const plot = useMemo(
    () =>
      buildWeightPlot({
        weights: data,
        dates: weightDates,
        rangeDays,
        projectedEndWeight,
        canProject,
        periodElapsedDays,
        placeholder: weightPlaceholder,
      }),
    [
      data,
      weightDates,
      rangeDays,
      projectedEndWeight,
      canProject,
      periodElapsedDays,
      weightPlaceholder,
    ]
  );

  const dayLabel = useMemo(
    () => makeDayLabeller(weightDates, locale, range),
    [weightDates, locale, range]
  );

  // Ticks resolve to labels by VALUE, never by tick index: a deduplicated tick
  // array used to fall out of step with a parallel label array and render
  // blanks.
  const tickLabels = useMemo(() => {
    const byValue = new Map<number, string>();
    for (const tick of plot.ticks) {
      byValue.set(
        tick.value,
        tick.kind === 'start'
          ? t('start')
          : tick.kind === 'now'
            ? t('now')
            : dayLabel(tick.value)
      );
    }
    return byValue;
  }, [plot.ticks, dayLabel, t]);

  const { isEmpty, band } = plot;
  const yAxis = yAxisGutter(band);
  const animate = !reduceMotion;

  return (
    <div className="flex h-full min-h-[200px] flex-col xl:min-h-0">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={plot.points}
            // Numbers live in the YAxis gutter on the left; the plot fills to the
            // right edge (small right margin so the last label isn't clipped).
            margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            role="img"
            // Nothing is logged: the bare frame says so on sight, but a screen
            // reader gets no frame — so the prompt lives here rather than as
            // visible copy over the plot.
            aria-label={isEmpty ? t('noWeightData') : t('weightChartAria')}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--kallo-border)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />

            <XAxis
              dataKey="day"
              type="number"
              domain={plot.xDomain}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--kallo-text-muted)' }}
              ticks={plot.ticks.map((tick) => tick.value)}
              tickFormatter={(value: number) => tickLabels.get(value) ?? ''}
            />
            <YAxis
              domain={[band.min, band.max]}
              ticks={band.ticks}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--kallo-text-muted)' }}
              tickFormatter={yAxis.format}
              width={yAxis.width}
            />

            {!isEmpty && (
              <Tooltip content={<WeightChartTooltip formatDay={dayLabel} />} />
            )}

            {/* Forecast — dotted projection toward the period end */}
            {plot.showForecast && (
              <Line
                type="linear"
                dataKey="forecast"
                stroke={ACCENT}
                strokeOpacity={0.6}
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinecap="round"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* Logged weight — a rounded spline with a dot at every reading */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke={ACCENT}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls={false}
              isAnimationActive={animate}
              animationDuration={animate ? 800 : 0}
              dot={makeReadingDot(data.length - 1, ACCENT, RING)}
              activeDot={{ r: 6, fill: ACCENT, stroke: RING, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
