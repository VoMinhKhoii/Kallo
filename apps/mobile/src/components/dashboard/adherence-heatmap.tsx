import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type {
  HeatmapCell,
  HeatmapData,
  HeatmapRange,
} from '@/lib/types/dashboard';
import { useHeatmap } from '~/lib/dashboard/use-heatmap';
import { getHeatmapColor, HEATMAP_COLORS } from '~/lib/dashboard/heatmap-colors';
import { Button, Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, fontSize, radii, shadow, space } from '~/theme/tokens';

/**
 * Adherence ("consistency") heatmap. Server-built grid (`useHeatmap`) rendered
 * as a fixed-size SVG grid of rounded cells, tinted via the vendored heatmap
 * colors. Mirrors web `components/dashboard/progress/adherence-heatmap.tsx`,
 * with the mobile adaptations called out in the port plan:
 *
 *  - No ResizeObserver: mobile picks a FIXED range (default '30d', which always
 *    fits a phone) and a FIXED cell size computed from the window width.
 *  - No hover tooltip: tapping a logged/partial cell shows its label in a small
 *    bubble above the cell (mobile has no hover/focus tooltip surface).
 *  - No i18n framework yet (mobile hardcodes the English strings, matching the
 *    other logging components); the strings mirror `messages/en.json`
 *    `dashboard.adherenceHeatmap` exactly.
 */

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const GAP: Record<HeatmapRange, number> = { '30d': 3, '90d': 2, year: 1 };
const DAY_LABEL_WIDTH = 16;
const DAY_LABEL_GUTTER = space[1]; // gap-1 between labels column and grid (4px)
const MONTH_STRIP_HEIGHT = 16; // web h-4
const CELL_RADIUS = 3; // rounded-[3px]

// i18n English mirrors (messages/en.json dashboard.adherenceHeatmap). The
// Vietnamese values live in messages/vi.json for when i18n is wired up.
const T = {
  onTrack: (percent: number) => `${percent}% on track`,
  notLogged: 'Not logged',
  partial: 'Partial day (under-logged)',
  future: 'Future day',
  outside: 'Outside selected range',
  offTarget: 'Off target',
  onTarget: 'On target',
  noData: 'No data',
  close: 'Close',
  slightlyOver: 'Slightly over',
  slightlyUnder: 'Slightly under',
  over: 'Over',
  under: 'Under',
  farOver: 'Far over',
  farUnder: 'Far under',
} as const;

const HEATMAP_LOAD_ERROR =
  'Unable to load the consistency section. Please try again.';
const RETRY = 'Try again';

interface Bubble {
  text: string;
  x: number; // center x of the cell, in svg/local coords
  y: number; // top y of the cell, in svg/local coords
}

export function AdherenceHeatmap() {
  // 30d (5 weeks) always fits a phone with cells comfortably >=10px. There is
  // no interactive range toggle on web — the label is passive — so mobile keeps
  // a single fixed range.
  const range: HeatmapRange = '30d';
  const query = useHeatmap(range);
  const { width: screenWidth } = useWindowDimensions();

  if (query.isError) {
    return (
      <Card style={styles.stateCard}>
        <Text variant="small" style={styles.stateMessage}>
          {HEATMAP_LOAD_ERROR}
        </Text>
        <Button
          title={RETRY}
          variant="ghost"
          onPress={() => query.refetch()}
        />
      </Card>
    );
  }

  // Empty falls through to the loaded grid: the server always returns a full
  // grid for the range (fully-unlogged days render as the "not logged" track),
  // so there is no distinct empty UI — matching web's emptyHeatmapData fallback.
  if (query.isPending || !query.data) {
    return <HeatmapBody data={null} range={range} screenWidth={screenWidth} />;
  }

  return (
    <HeatmapBody data={query.data} range={range} screenWidth={screenWidth} />
  );
}

interface HeatmapBodyProps {
  data: HeatmapData | null;
  range: HeatmapRange;
  screenWidth: number;
}

/**
 * Renders the grid. `data === null` is the loading skeleton (faint track cells
 * for the range's nominal week count, no tooltips, no header percent).
 */
function HeatmapBody({ data, range, screenWidth }: HeatmapBodyProps) {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const gap = GAP[range];

  // Server decides the exact column count; while loading, fall back to the
  // range's nominal width (web HeatmapSkeleton uses 5 / 14 / 53).
  const skeletonWeeks = range === '30d' ? 5 : range === '90d' ? 14 : 53;
  const numWeeks = data ? (data.cells[0]?.length ?? 0) : skeletonWeeks;

  // Fixed cell size: fit the grid into the card's inner width using the same
  // heuristic as the web ResizeObserver (DAY_LABEL_WIDTH + small gutter + gaps),
  // clamped to >=10px. The card has horizontal chrome of border(2) + padding
  // (space[3] * 2) on each side.
  const cardChromeX = 2 + space[3] * 2;
  const contentWidth = screenWidth - space[4] * 2 - cardChromeX; // screen padding ~ space[4]
  const sq = useMemo(() => {
    if (numWeeks <= 0) return 10;
    const available =
      contentWidth - DAY_LABEL_WIDTH - DAY_LABEL_GUTTER - (numWeeks - 1) * gap;
    return Math.max(10, Math.floor(available / numWeeks));
  }, [contentWidth, numWeeks, gap]);

  const adherenceRate = useMemo(() => {
    if (!data) return 0;
    let onTarget = 0;
    let total = 0;
    for (const row of data.cells) {
      for (const cell of row) {
        if (cell.status === 'logged' && cell.ratio !== null) {
          total++;
          if (Math.abs(cell.ratio - 1.0) <= 0.1) onTarget++;
        }
      }
    }
    return total > 0 ? Math.round((onTarget / total) * 100) : 0;
  }, [data]);

  const step = sq + gap;
  const gridWidth = numWeeks > 0 ? numWeeks * sq + (numWeeks - 1) * gap : 0;
  const gridHeight = 7 * sq + 6 * gap;

  const onCellPress = (cell: HeatmapCell, wi: number, di: number) => {
    const isLogged = cell.status === 'logged' && cell.ratio !== null;
    const isPartial = cell.status === 'partial';
    const isMuted = cell.status === 'future' || cell.status === 'outside';
    // Only logged/partial cells respond (web's isFocusable rule).
    if (!((isLogged || isPartial) && !isMuted)) return;
    const text = getTooltipText(cell);
    const x = wi * step + sq / 2;
    const y = di * step;
    setBubble((prev) =>
      prev && prev.text === text && prev.x === x && prev.y === y ? null : { text, x, y }
    );
  };

  return (
    <Card style={styles.card}>
      {/* Header: "{percent}% on track" */}
      <View style={styles.header}>
        <Text variant="captionTabular" style={styles.headerLabel}>
          {data ? T.onTrack(adherenceRate) : ' '}
        </Text>
      </View>

      {/* Grid body: day-labels column + (month strip over cell grid) */}
      <View style={styles.body}>
        {/* Day labels. A top spacer matching the month strip height keeps each
            day row aligned with its cell row (the strip sits above the grid). */}
        <View style={styles.dayLabels}>
          {DAY_LABELS.map((d, i) => (
            <View
              key={`lbl-${i}`}
              style={[
                styles.dayLabelCell,
                {
                  height: sq,
                  marginTop: i === 0 ? MONTH_STRIP_HEIGHT + space[1] : gap,
                },
              ]}
            >
              <Text style={styles.dayLabelText}>{d}</Text>
            </View>
          ))}
        </View>

        <View>
          {/* Month headers strip */}
          <View style={[styles.monthStrip, { width: gridWidth }]}>
            {data?.monthHeaders.map((h) => (
              <Text
                key={`${h.month}-${h.startColumn}`}
                numberOfLines={1}
                style={[
                  styles.monthLabel,
                  {
                    left: h.startColumn * step,
                    width: h.span * sq + Math.max(0, h.span - 1) * gap,
                  },
                ]}
              >
                {h.month}
              </Text>
            ))}
          </View>

          {/* Cell grid (SVG). Iteration: outer week column, inner day row;
              cells indexed [dayRow][weekColumn]. */}
          <View>
            <Svg width={gridWidth} height={gridHeight}>
              {Array.from({ length: numWeeks }, (_, wi) =>
                DAY_LABELS.map((_label, di) => {
                  const cell = data?.cells[di]?.[wi] ?? null;
                  const props = cellRectProps(cell);
                  return (
                    <Rect
                      key={`${di}-${wi}`}
                      x={wi * step}
                      y={di * step}
                      width={sq}
                      height={sq}
                      rx={CELL_RADIUS}
                      ry={CELL_RADIUS}
                      fill={props.fill}
                      fillOpacity={props.fillOpacity}
                      opacity={props.opacity}
                      stroke={props.stroke}
                      strokeWidth={props.stroke ? 1 : undefined}
                      onPress={
                        data && cell
                          ? () => onCellPress(cell, wi, di)
                          : undefined
                      }
                    />
                  );
                })
              )}
            </Svg>

            {bubble ? (
              <View
                style={[
                  styles.bubble,
                  {
                    // Position above the pressed cell; clamp to the grid edges.
                    left: clamp(bubble.x - BUBBLE_HALF_W, 0, Math.max(0, gridWidth - BUBBLE_HALF_W * 2)),
                    bottom: gridHeight - bubble.y + space[1],
                  },
                ]}
              >
                <Text style={styles.bubbleText}>{bubble.text}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Legend: Off target — diverging gradient bar — On target */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>{T.offTarget}</Text>
        <View style={styles.legendBarWrap}>
          <Svg width="100%" height={LEGEND_BAR_HEIGHT}>
            <Defs>
              <LinearGradient id="adherenceLegend" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={HEATMAP_COLORS.far} />
                <Stop offset="0.25" stopColor={HEATMAP_COLORS.moderate} />
                <Stop offset="0.5" stopColor={HEATMAP_COLORS.slight} />
                <Stop offset="0.75" stopColor={HEATMAP_COLORS.close} />
                <Stop offset="1" stopColor={HEATMAP_COLORS.onTarget} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width="100%"
              height={LEGEND_BAR_HEIGHT}
              rx={LEGEND_BAR_HEIGHT / 2}
              ry={LEGEND_BAR_HEIGHT / 2}
              fill="url(#adherenceLegend)"
            />
          </Svg>
        </View>
        <Text style={styles.legendLabel}>{T.onTarget}</Text>
      </View>
    </Card>
  );
}

const BUBBLE_HALF_W = 60;
const LEGEND_BAR_HEIGHT = 6;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/**
 * SVG fill/stroke for one cell, mirroring the web cell appearance:
 *  - logged + ratio → solid heatmap color
 *  - future/outside (muted) → track @55% * 70% opacity (very faint)
 *  - partial → track @30% + 1px border
 *  - otherwise (unlogged) → track @30%
 */
function cellRectProps(cell: HeatmapCell | null): {
  fill: string;
  fillOpacity?: number;
  opacity?: number;
  stroke?: string;
} {
  const ratio = cell?.ratio ?? null;
  const isLogged = cell?.status === 'logged' && ratio !== null;
  if (isLogged) {
    return { fill: getHeatmapColor(ratio).bg };
  }
  const isMuted = cell?.status === 'future' || cell?.status === 'outside';
  if (isMuted) {
    return { fill: colors.track, fillOpacity: 0.55, opacity: 0.7 };
  }
  const isPartial = cell?.status === 'partial';
  return {
    fill: colors.track,
    fillOpacity: 0.3,
    stroke: isPartial ? colors.border : undefined,
  };
}

/** Tooltip text, mirroring web getTooltipText (middot separator for logged). */
function getTooltipText(cell: HeatmapCell): string {
  if (cell.status === 'future') return T.future;
  if (cell.status === 'outside') return T.outside;
  if (cell.status === 'partial') return T.partial;
  if (cell.status !== 'logged' || cell.ratio === null) return T.notLogged;
  const { labelKey } = getHeatmapColor(cell.ratio);
  return `${T[labelKey as keyof typeof T] ?? labelKey} · ${Math.round(cell.ratio * 100)}%`;
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.borderSoft,
    borderRadius: radii['3xl'], // 22px — closest single radius family to web's 24px
    padding: space[3],
    ...shadow.md,
  },
  header: { marginBottom: 6 },
  headerLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  body: { flexDirection: 'row', alignItems: 'center', gap: DAY_LABEL_GUTTER },
  dayLabels: { width: DAY_LABEL_WIDTH, justifyContent: 'flex-start' },
  dayLabelCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: space[1],
  },
  dayLabelText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  monthStrip: {
    height: MONTH_STRIP_HEIGHT,
    marginBottom: space[1],
    position: 'relative',
  },
  monthLabel: {
    position: 'absolute',
    top: 0,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.text,
    borderRadius: radii.sm,
    paddingVertical: space[1],
    paddingHorizontal: 6,
    maxWidth: BUBBLE_HALF_W * 2,
  },
  bubbleText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'center',
  },
  legend: {
    marginTop: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  legendLabel: { fontFamily: fonts.sansRegular, fontSize: 9, color: colors.stone },
  legendBarWrap: {
    flex: 1,
    height: LEGEND_BAR_HEIGHT,
    borderRadius: LEGEND_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  stateCard: {
    borderColor: colors.borderSoft,
    borderRadius: radii['3xl'],
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  stateMessage: {
    color: colors.stone,
    textAlign: 'center',
    maxWidth: 280,
  },
});
