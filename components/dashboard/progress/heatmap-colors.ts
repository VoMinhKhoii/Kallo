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
/**
 * Where a day's ratio lands. The colour and the i18n key are both DERIVED from
 * this, so the two can never disagree — the on-track score asks for a tier, not
 * for a string that happens to spell one.
 */
export type HeatmapTier =
  | 'onTarget'
  | 'nearlyFull'
  | 'light'
  | 'veryLight'
  | 'overTarget'
  | 'noData';

export const HEATMAP_BANDS = {
  gate: 0.85,
  overTarget: 1.15,
} as const;

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
 * Where a cell's adherence `ratio` lands (1.0 == exactly on target).
 *
 * The three sub-`gate` steps are reachable ONLY for a day the user attested:
 * the server nulls `ratio` on an unattested day under the gate, so it never
 * arrives here. A pale green cell therefore always means "the user confirmed
 * they ate this little", never "we are guessing".
 */
export function heatmapTierFor(ratio: number | null): HeatmapTier {
  if (ratio === null) return 'noData';
  if (ratio > HEATMAP_BANDS.overTarget) return 'overTarget';
  if (ratio >= HEATMAP_BANDS.gate) return 'onTarget';
  if (ratio >= 0.65) return 'nearlyFull';
  if (ratio >= 0.4) return 'light';
  return 'veryLight';
}

/** The fill a tier paints. `noData` has nothing to grade. */
export function heatmapTierColor(tier: HeatmapTier): string {
  switch (tier) {
    case 'noData':
      return 'transparent';
    case 'overTarget':
      return HEATMAP_COLORS.over;
    case 'onTarget':
      return heatmapScaleAt(HEATMAP_RAMP.onTarget);
    case 'nearlyFull':
      return heatmapScaleAt(HEATMAP_RAMP.nearlyFull);
    case 'light':
      return heatmapScaleAt(HEATMAP_RAMP.light);
    case 'veryLight':
      return heatmapScaleAt(HEATMAP_RAMP.veryLight);
  }
}

/** The corner radius every cell and every legend swatch draws. */
export const HEATMAP_CELL_RADIUS_CLASS = 'rounded-[3px]';

export interface HeatmapCellPaint {
  backgroundColor: string;
  /** Set only for the cheat day — the grid's one gradient. */
  backgroundImage?: string;
  /** Tailwind ring classes; set only for the one actionable cell. */
  ringClass?: string;
}

/** The aurora wash, pre-composited onto the cheat base. See HEATMAP_CELL_PAINTS. */
function auroraOver(hue: string): string {
  return `color-mix(in srgb, var(${hue}) 92%, var(--kallo-cheat-fill))`;
}

/**
 * What each kind of cell is painted with — the single definition the grid cell
 * AND the legend swatch both read.
 *
 * This exists because sharing the COLOURS was not enough. The cheat swatch once
 * drew a flat fill inside an accent ring while the cell drew a ringless wash;
 * the web legend omitted both the cheat and the awaiting cell entirely. Each
 * surface assembled its own recipe from the parts, so what drifts is the
 * assembly — and the assembly is what has to be shared.
 *
 * The cheat wash is PRE-COMPOSITED via `color-mix` rather than layered as a
 * translucent `backgroundImage` over `backgroundColor`. Blending at a fixed
 * alpha is affine in the colour, so the result is identical, and mixing into
 * `--kallo-cheat-fill` keeps dark mode's darker base behaving as before. It
 * also derives from the brand tokens the way the Flutter twin does, instead of
 * baking the two hues in as literals.
 */
export const HEATMAP_CELL_PAINTS: Record<
  'cheat' | 'awaiting' | 'empty',
  HeatmapCellPaint
> = {
  cheat: {
    backgroundColor: 'var(--kallo-cheat-fill)',
    backgroundImage: `linear-gradient(180deg, ${auroraOver('--kallo-brand-apricot')}, ${auroraOver('--kallo-brand-lilac')})`,
  },
  awaiting: {
    backgroundColor: heatmapScaleAt(HEATMAP_RAMP.awaiting),
    ringClass: 'border border-kallo-text-muted',
  },
  empty: { backgroundColor: heatmapScaleAt(HEATMAP_RAMP.empty) },
};

/** A graded day. `noData` has nothing to grade, so it falls back to `empty`. */
export function heatmapTierPaint(tier: HeatmapTier): HeatmapCellPaint {
  return tier === 'noData'
    ? HEATMAP_CELL_PAINTS.empty
    : { backgroundColor: heatmapTierColor(tier) };
}
