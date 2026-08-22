'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateSpan } from '@/lib/domain/nutrition/bucket-detail';
import type { DaySeriesBucketUnit } from '@/lib/domain/nutrition/types';
import {
  buildBucketTickLabels,
  buildMacroTrendAxis,
  COMPOSITION_COLORS,
  COMPOSITION_KEYS,
  type CompositionKey,
  isColumnDimmed,
  type MacroTrendPoint,
} from './macro-trend-utils';

interface MacroTrendChartProps {
  points: MacroTrendPoint[];
  maxY: number;
  unit: DaySeriesBucketUnit;
  /** Index of the bucket holding today, or -1. Rendered heavier on the axis. */
  todayIndex: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

interface AxisTickProps {
  x?: number;
  y?: number;
  index?: number;
}

/** Rounded top on the topmost band only. */
const RADIUS: Partial<
  Record<CompositionKey, [number, number, number, number]>
> = { fat: [4, 4, 0, 0] };

/**
 * Stacked macro-calorie bars — the Flutter `MacroTrendChart` port. One rounded
 * column per bucket, split bottom→top into protein / carbs / fat kcal bands in
 * the chart pigments that match the `DaySummary` legend. Multi-day ranges only;
 * no tooltip — a column is tapped, not hovered.
 */
export function MacroTrendChart({
  points,
  maxY,
  unit,
  todayIndex,
  selectedIndex,
  onSelect,
}: MacroTrendChartProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();

  const { topY, ticks } = buildMacroTrendAxis(maxY);
  const tickLabels = buildBucketTickLabels(points, unit, locale);
  // Fewer, fatter columns for the 7-day view; slimmer ones for the busier
  // weekly axes (5 buckets at 30d, 13 at 90d) so they don't crowd.
  const barSize = points.length <= 7 ? 18 : 10;

  const renderTick = ({ x, y, index }: AxisTickProps) => {
    const i = index ?? 0;
    const emphasised = i === todayIndex || i === selectedIndex;
    return (
      <text
        x={x}
        y={y}
        dy={10}
        textAnchor="middle"
        fontSize={10}
        // 500 is this palette's weight ceiling — today reads heavier than its
        // neighbours without turning into a second heading.
        fontWeight={emphasised ? 500 : 400}
        fill={emphasised ? 'var(--kallo-text)' : 'var(--kallo-text-muted)'}
      >
        {tickLabels[i] ?? ''}
      </text>
    );
  };

  // Grey means "not being counted" — see `isColumnDimmed` for which sense of
  // that applies. Fading instead only washed the columns toward the page and
  // left three pale bands still competing for attention; greying makes each one
  // read as a single quiet block.
  const fillFor = (key: CompositionKey, point: MacroTrendPoint) =>
    isColumnDimmed(point, selectedIndex)
      ? 'var(--kallo-chart-muted)'
      : COMPOSITION_COLORS[key];

  return (
    // Selecting a column and dismissing the selection are the same gesture at
    // different targets, so the chart keeps its clicks to itself.
    <div
      className="mt-4 h-[248px] w-full"
      onClick={(event) => event.stopPropagation()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          // The last column sits near the right edge, so a centred tick label
          // under it needs room the y-axis gutter can spare — see `width` below.
          margin={{ top: 8, right: 14, bottom: 4, left: 0 }}
          role="img"
          aria-label={t('rhythm.macroTrendAria')}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="4 4"
            stroke="var(--kallo-border)"
          />

          <XAxis
            dataKey="index"
            interval={0}
            tickLine={false}
            axisLine={false}
            tick={renderTick}
          />
          <YAxis
            domain={[0, topY]}
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--kallo-text-muted)' }}
            tickFormatter={(v: number) => String(Math.round(v))}
            // Four digits at 10px plus the tick gap, sized generously — too
            // tight and a "3000" tick wraps.
            width={34}
          />

          {COMPOSITION_KEYS.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="macros"
              fill={COMPOSITION_COLORS[key]}
              radius={RADIUS[key]}
              barSize={barSize}
              isAnimationActive={false}
              onClick={(_data, index) => onSelect(index)}
              className="cursor-pointer"
            >
              {points.map((point) => (
                <Cell key={point.startDate} fill={fillFor(key, point)} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Keyboard/AT path to the same selection the columns offer on tap. */}
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.startDate}>
            <button
              type="button"
              aria-pressed={point.index === selectedIndex}
              onClick={() => onSelect(point.index)}
            >
              {formatDateSpan(point.startDate, point.endDate, locale)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
