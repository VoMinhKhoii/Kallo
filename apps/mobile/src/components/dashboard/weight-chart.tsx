import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import type { WeightSummaryData } from '@/lib/api/contracts/weight';
import type { WeightGoalDirection, WeightRange } from '@/lib/types/weight';
import { useWeightSummary } from '~/lib/dashboard/use-weight';
import {
  buildWeightTrendSummary,
  type WeightTrendStatus,
} from '~/lib/dashboard/weight-trend';
import { buildXTicks } from '~/lib/dashboard/weight-chart-utils';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, fontSize, radii, space } from '~/theme/tokens';

/**
 * Mobile WeightChart — 1:1 port of the web ProgressStory + WeightChart
 * (components/dashboard/progress/{progress-story,weight-chart}.tsx), drawn with
 * react-native-svg instead of recharts. Self-contained: owns its range tabs,
 * calls `useWeightSummary`, and renders its own loading / error / empty states.
 *
 * Layout (web is a 2-col grid; mobile stacks): [1] trend callout, [2] chart.
 * CompactWeightLog is a separate component and is intentionally out of scope.
 *
 * Copy is the English text from messages/en.json verbatim — the mobile app has
 * no i18n framework wired yet (matches the other mobile components).
 */

// --- copy (verbatim from messages/en.json `dashboard`) ---------------------
const STATUS_COPY: Record<WeightTrendStatus, { label: string; detail: string }> =
  {
    insufficient: {
      label: 'Tracking started',
      detail: 'Log tomorrow to see your trend.',
    },
    on_pace: {
      label: 'On pace',
      detail: 'Your current pace is matching the plan.',
    },
    ahead: {
      label: 'Ahead of plan',
      detail: 'Progress is moving faster than expected.',
    },
    behind: {
      label: 'Needs attention',
      detail: 'The trend is softer than the plan right now.',
    },
    stable: {
      label: 'Stable',
      detail: 'Your weight is staying within a quiet maintenance band.',
    },
  };

const COPY = {
  kg: 'kg',
  now: 'Now',
  projected: 'Projected',
  start: 'Start',
  weekPrefix: 'W',
  offTrack: 'Off track',
  noWeightData: 'Log your first weight to start tracking your trend.',
  loadingWeightTrend: 'Loading weight trend…',
  progressLoadError: 'Unable to load the weight trend. Please try again.',
} as const;

// --- chart geometry --------------------------------------------------------
const MARGIN = { top: 4, right: 12, bottom: 4, left: 0 } as const;
const Y_GUTTER = 36; // web YAxis width=36
const X_AXIS_H = 16; // room for x-tick labels
const CHART_H = 200; // web min-h-[200px]

/** Catmull-Rom → cubic-bezier path, matching recharts `type="monotone"` feel. */
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function WeightChart() {
  // Web derives the range from container width; on a phone that is always the
  // 30-day view (the section header shows the passive "30 days" label). No
  // interactive tabs — matches the web mobile rendering.
  const range: WeightRange = '30d';
  const { data, isLoading, isError } = useWeightSummary(range);

  return (
    <Card style={styles.card}>
      {isLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="small" style={styles.stateText}>
            {COPY.loadingWeightTrend}
          </Text>
        </View>
      ) : isError || !data ? (
        <View style={styles.stateBox}>
          <Text variant="small" style={styles.stateText}>
            {COPY.progressLoadError}
          </Text>
        </View>
      ) : (
        <Body data={data} range={range} />
      )}
    </Card>
  );
}

function Body({ data, range }: { data: WeightSummaryData; range: WeightRange }) {
  const summary = useMemo(
    () =>
      buildWeightTrendSummary({
        weights: data.weights,
        periodStartWeight: data.periodStartWeight,
        expectedEndWeight: data.expectedEndWeight,
        goalDirection: data.goalDirection,
        range,
        elapsedDays: data.periodElapsedDays,
      }),
    [data, range]
  );

  const copy = STATUS_COPY[summary.status];
  const isInsufficient = summary.status === 'insufficient';
  const delta = summary.currentWeight - summary.startWeight;
  const behind = summary.status === 'behind';

  return (
    <View style={styles.body}>
      {/* [1] Trend / delta callout */}
      <View style={styles.callout}>
        <View
          style={[styles.pill, behind ? styles.pillBehind : styles.pillAccent]}
        >
          <Text
            style={[
              styles.pillText,
              { color: behind ? colors.danger : colors.accent },
            ]}
          >
            {copy.label}
          </Text>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <Text style={styles.hero}>
              {isInsufficient
                ? `${summary.currentWeight.toFixed(1)} ${COPY.kg}`
                : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${COPY.kg}`}
            </Text>
            <Text variant="italicAccent" style={styles.detail}>
              {copy.detail}
            </Text>
          </View>

          {!isInsufficient && (
            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text variant="eyebrow" style={styles.tileLabel}>
                  {COPY.now}
                </Text>
                <Text variant="numCaption" style={styles.tileValue}>
                  {summary.currentWeight.toFixed(1)} {COPY.kg}
                </Text>
              </View>
              {summary.canProject && (
                <View style={styles.tile}>
                  <Text variant="eyebrow" style={styles.tileLabel}>
                    {COPY.projected}
                  </Text>
                  <Text variant="numCaption" style={styles.tileValue}>
                    {summary.projectedEndWeight.toFixed(1)} {COPY.kg}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* [2] Chart */}
      <ChartCanvas
        data={data.weights}
        periodStartWeight={data.periodStartWeight}
        expectedEndWeight={data.expectedEndWeight}
        goalDirection={data.goalDirection}
        range={range}
      />
    </View>
  );
}

function ChartCanvas({
  data,
  periodStartWeight,
  expectedEndWeight,
  goalDirection,
  range,
}: {
  data: number[];
  periodStartWeight: number;
  expectedEndWeight: number;
  goalDirection: WeightGoalDirection;
  range: WeightRange;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  if (data.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text variant="small" style={styles.stateText}>
          {COPY.noWeightData}
        </Text>
      </View>
    );
  }

  const isSinglePoint = data.length === 1;
  const rangeDays = range === '30d' ? 30 : 90;

  // Y domain — clamped to goal range, expanding if data exceeds it.
  const goalTop = Math.max(periodStartWeight, expectedEndWeight);
  const goalBottom = Math.min(periodStartWeight, expectedEndWeight);
  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  const yMin = Math.min(goalBottom, dataMin) - 0.3;
  const yMax = Math.max(goalTop, dataMax) + 0.3;

  const yTicks = [periodStartWeight, expectedEndWeight].filter(
    (value, index, arr) => arr.indexOf(value) === index
  );

  // Plot rect (inside gutter + margins).
  const plotLeft = Y_GUTTER + MARGIN.left;
  const plotRight = width - MARGIN.right;
  const plotW = Math.max(0, plotRight - plotLeft);
  const plotTop = MARGIN.top;
  const plotBottom = CHART_H - X_AXIS_H - MARGIN.bottom;
  const plotH = Math.max(0, plotBottom - plotTop);

  const yToPx = (v: number) =>
    plotBottom - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  // X domain: single-point uses [0, rangeDays-1]; else index 0..N-1.
  const xMax = isSinglePoint ? rangeDays - 1 : data.length - 1;
  const xToPx = (i: number) => plotLeft + (i / (xMax || 1)) * plotW;

  const points = data.map((w, i) => ({ x: xToPx(i), y: yToPx(w) }));
  const linePath = monotonePath(points);
  const areaPath =
    points.length >= 2
      ? `${linePath} L ${points[points.length - 1].x} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
      : '';

  // Off-track band: above start (losing), below start (gaining), none (flat).
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
  const showBand = offTrackTop !== null && offTrackBottom !== null;
  const bandY = showBand ? yToPx(offTrackTop as number) : 0;
  const bandH = showBand
    ? yToPx(offTrackBottom as number) - yToPx(offTrackTop as number)
    : 0;

  const refY = yToPx(periodStartWeight);

  // X ticks + labels.
  const { ticks: xTicks, formatter: xFormatter } = isSinglePoint
    ? { ticks: [0], formatter: () => COPY.start }
    : buildXTicks(data.length, range, 'en', COPY.now, COPY.weekPrefix);

  // Press / drag → nearest data point (View responder system; no PanResponder
  // ref so we don't read a ref during render).
  function updateActive(e: GestureResponderEvent) {
    if (plotW <= 0) return;
    const localX = e.nativeEvent.locationX - plotLeft;
    const frac = Math.min(1, Math.max(0, localX / plotW));
    const idx = Math.round(frac * (data.length - 1));
    setActive(Math.min(data.length - 1, Math.max(0, idx)));
  }

  const activeIdx = isSinglePoint ? 0 : active;
  const showDot = isSinglePoint || activeIdx !== null;
  const dotX = activeIdx !== null ? points[activeIdx]?.x : undefined;
  const dotY = activeIdx !== null ? points[activeIdx]?.y : undefined;

  return (
    <View>
      {goalDirection !== 'flat' && (
        <View style={styles.legend}>
          <View style={styles.legendSwatch} />
          <Text variant="meta" style={styles.legendLabel}>
            {COPY.offTrack}
          </Text>
        </View>
      )}

      <View
        onLayout={onLayout}
        style={styles.canvas}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateActive}
        onResponderMove={updateActive}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      >
        {width > 0 && (
          <Svg width={width} height={CHART_H}>
            <Defs>
              <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.18} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Off-track shaded band */}
            {showBand && (
              <Rect
                x={plotLeft}
                y={bandY}
                width={plotW}
                height={bandH}
                fill={colors.danger}
                fillOpacity={0.08}
              />
            )}

            {/* Y axis line + tick labels */}
            <Line
              x1={plotLeft}
              y1={plotTop}
              x2={plotLeft}
              y2={plotBottom}
              stroke={colors.border}
              strokeWidth={1}
            />
            {/* X axis line */}
            <Line
              x1={plotLeft}
              y1={plotBottom}
              x2={plotRight}
              y2={plotBottom}
              stroke={colors.border}
              strokeWidth={1}
            />

            {/* Reference line at periodStartWeight */}
            <Line
              x1={plotLeft}
              y1={refY}
              x2={plotRight}
              y2={refY}
              stroke={colors.danger}
              strokeOpacity={0.25}
              strokeWidth={1}
            />

            {/* Area + line */}
            {areaPath !== '' && <Path d={areaPath} fill="url(#lineGrad)" />}
            <Path
              d={linePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Active / single-point dot */}
            {showDot && dotX !== undefined && dotY !== undefined && (
              <Circle
                cx={dotX}
                cy={dotY}
                r={4}
                fill={colors.accent}
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
          </Svg>
        )}

        {/* Y tick labels (left gutter) */}
        {width > 0 &&
          yTicks.map((t) => (
            <Text
              key={`y-${t}`}
              style={[styles.yTick, { top: yToPx(t) - 6 }]}
            >
              {t.toFixed(1)}
            </Text>
          ))}

        {/* X tick labels (bottom) */}
        {width > 0 &&
          xTicks.map((t, i) => (
            <Text
              key={`x-${t}`}
              style={[
                styles.xTick,
                { left: xToPx(t) - 18, width: 36, top: plotBottom + 3 },
              ]}
            >
              {xFormatter(t, i)}
            </Text>
          ))}

        {/* Press tooltip */}
        {activeIdx !== null && dotX !== undefined && dotY !== undefined && (
          <View
            style={[
              styles.tooltip,
              {
                left: Math.min(
                  Math.max(0, dotX - 28),
                  Math.max(0, width - 64)
                ),
                top: Math.max(0, dotY - 34),
              },
            ]}
          >
            <Text style={styles.tooltipText}>
              {data[activeIdx].toFixed(1)} {COPY.kg}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.borderSoft,
    borderRadius: radii['4xl'],
    gap: space[3],
  },
  // Loading / error / empty boxes
  stateBox: {
    minHeight: CHART_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  stateText: { color: colors.stone, textAlign: 'center' },
  emptyBox: {
    minHeight: CHART_H,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { gap: space[3] },

  // Trend callout
  callout: {
    borderRadius: radii['2xl'],
    backgroundColor: colors.surface80,
    padding: space[3],
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: space[2],
  },
  pillAccent: { backgroundColor: colors.accentSelectedFill },
  pillBehind: { backgroundColor: 'rgba(211, 123, 105, 0.1)' },
  pillText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
  },
  heroLeft: { flexShrink: 1 },
  hero: {
    fontFamily: fonts.serifMedium, // Lora 500 — never bold
    fontSize: fontSize.h2,
    letterSpacing: -1.2,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    fontFamily: fonts.serifItalic,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.accent,
    marginTop: space[1],
  },

  tiles: { flexDirection: 'row', gap: space[2] },
  tile: {
    borderRadius: radii.buttonXl,
    backgroundColor: colors.elevTranslucent,
    paddingHorizontal: 10,
    paddingVertical: space[2],
  },
  tileLabel: { fontSize: 9, letterSpacing: 1.4 },
  tileValue: { color: colors.text, marginTop: 2 },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  legendSwatch: {
    width: 12,
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.danger,
    opacity: 0.5,
  },
  legendLabel: { color: colors.stone, fontSize: fontSize.eyebrow },

  // Chart canvas
  canvas: { height: CHART_H, position: 'relative' },
  yTick: {
    position: 'absolute',
    left: 0,
    width: Y_GUTTER - 4,
    textAlign: 'right',
    fontFamily: fonts.sansRegular,
    fontSize: 9,
    color: colors.stone,
    fontVariant: ['tabular-nums'],
  },
  xTick: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: fonts.sansRegular,
    fontSize: 9,
    color: colors.stone,
  },

  // Tooltip
  tooltip: {
    position: 'absolute',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.elev,
    paddingHorizontal: space[3],
    paddingVertical: 6,
  },
  tooltipText: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.xs,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
