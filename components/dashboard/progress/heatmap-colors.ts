/**
 * Vendored twin of
 * `apps/mobile-flutter/lib/features/dashboard/logic/heatmap_colors.dart` — keep
 * the bands, the ramp and the on-track label set in sync with it.
 *
 * One hue, five steps of opacity, plus one colour that is not on the scale at
 * all.
 *
 * **Green says how much of the goal the day reached**, deepening to target and
 * stopping there. Within it more is better, monotonically, the way a
 * contribution graph reads — so a pale cell is unambiguously "ate less", never
 * "off target in some direction".
 *
 * Over-target does NOT continue the ramp. If it did, a 60% day and a 150% day
 * would land on the same pale green while still faintly reading as "some good",
 * which is the exact ambiguity the ramp exists to avoid.
 */
export const HEATMAP_COLORS = {
  /** The one hue the scale is built from. */
  scale: 'var(--kallo-heatmap-on-target)',
  /** Over target — the one warm cell, ungraded on purpose. */
  over: 'var(--kallo-heatmap-far)',
} as const;

/**
 * The ramp, as alpha applied to `HEATMAP_COLORS.scale`. Ported from amicro's
 * `dither-heatmap`, which paints one hex at five opacities rather than five
 * hues — that is what lets an empty cell be the same material as a full one
 * instead of a grey from a second palette.
 */
export const HEATMAP_RAMP = {
  onTarget: 1,
  nearlyFull: 0.8,
  light: 0.55,
  veryLight: 0.3,
  /** Nothing logged, or outside the window — the hue at a whisper, not a grey. */
  empty: 0.08,
  /**
   * A logged day under the gate the user has NOT attested yet: the one cell
   * that wants them to act, so the one cell with a ring. Above `empty` because
   * at the 15px cell a small phone draws, a 1px ring on an 8% interior is the
   * only thing separating it from a blank day; still below `veryLight`, so it
   * adds no rung to the ladder.
   */
  awaiting: 0.16,
} as const;

/**
 * The two boundaries of the scale.
 *
 * `gate` is deliberately the SAME number as `PARTIAL_DAY_FRACTION`: a day
 * either reached 85% of its target or it did not, and that one fact decides
 * both whether the day counts toward trends and where it lands on the ramp.
 * Two numbers here would be two stories.
 */
export const HEATMAP_BANDS = {
  gate: 0.85,
  overTarget: 1.15,
} as const;

/** The label keys that count toward "% on track". */
export const ON_TRACK_LABELS = new Set(['onTarget']);

export function heatmapScaleAt(opacity: number): string {
  return `color-mix(in srgb, ${HEATMAP_COLORS.scale} ${opacity * 100}%, transparent)`;
}

/**
 * The legend's ramp swatches, palest first. A discrete set, not a gradient: a
 * continuous bar named only at its two ends is what let the old five-tier scale
 * over-promise, since the under-target half it implied could never paint.
 */
export function heatmapLegendSwatches(): string[] {
  return [
    HEATMAP_RAMP.empty,
    HEATMAP_RAMP.veryLight,
    HEATMAP_RAMP.light,
    HEATMAP_RAMP.nearlyFull,
    HEATMAP_RAMP.onTarget,
  ].map(heatmapScaleAt);
}

/**
 * Resolved fill + i18n label key for a cell's adherence `ratio`
 * (1.0 == exactly on target).
 *
 * The three sub-`gate` steps are reachable ONLY for a day the user attested:
 * the server nulls `ratio` on an unattested day under the gate, so it never
 * arrives here. A pale green cell therefore always means "the user confirmed
 * they ate this little", never "we are guessing".
 */
export function getHeatmapColor(ratio: number | null): {
  bg: string;
  labelKey: string;
} {
  if (ratio === null) return { bg: 'transparent', labelKey: 'noData' };
  if (ratio > HEATMAP_BANDS.overTarget) {
    return { bg: HEATMAP_COLORS.over, labelKey: 'overTarget' };
  }
  if (ratio >= HEATMAP_BANDS.gate) {
    return { bg: heatmapScaleAt(HEATMAP_RAMP.onTarget), labelKey: 'onTarget' };
  }
  if (ratio >= 0.65) {
    return {
      bg: heatmapScaleAt(HEATMAP_RAMP.nearlyFull),
      labelKey: 'nearlyFull',
    };
  }
  if (ratio >= 0.4) {
    return { bg: heatmapScaleAt(HEATMAP_RAMP.light), labelKey: 'light' };
  }
  return { bg: heatmapScaleAt(HEATMAP_RAMP.veryLight), labelKey: 'veryLight' };
}
