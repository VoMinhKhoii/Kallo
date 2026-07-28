export const HEATMAP_COLORS = {
  onTarget: 'var(--nham-heatmap-on-target)',
  close: 'var(--nham-heatmap-close)',
  slight: 'var(--nham-heatmap-slight)',
  moderate: 'var(--nham-heatmap-moderate)',
  far: 'var(--nham-heatmap-far)',
} as const;

/**
 * The band edges, as |ratio - 1|. The classifier and the legend bar both read
 * these, so the bar can never advertise a scale the cells don't use.
 *
 * Deliberately wide: two of the five colours read as red, so a narrow scale
 * painted an ordinary ±20% day as failure. Red starts at ±50% — "ate half or
 * double the target" — which is worth noticing.
 */
export const HEATMAP_BANDS = {
  /** OVER target — the signal worth keeping sharp. */
  over: { onTarget: 0.1, close: 0.2, slight: 0.35, moderate: 0.5 },
  /**
   * UNDER target — deliberately more forgiving. Most under-target days are
   * under-LOGGED rather than under-eaten (a forgotten snack is
   * indistinguishable from a deficit), so treating both directions equally
   * coloured ordinary days as failure.
   */
  under: { onTarget: 0.2, close: 0.3, slight: 0.4, moderate: 0.5 },
} as const;

/** Label keys that count toward "% on track" — green + light green. */
export const HEATMAP_ON_TRACK_LABELS = new Set(['onTarget', 'close']);

/**
 * Each band's width in |ratio-1| space, off-target → on-target. `far` is
 * unbounded above, so it takes the same width as `moderate`.
 */
const LEGEND_WIDTHS = [
  HEATMAP_BANDS.over.moderate - HEATMAP_BANDS.over.slight, // far
  HEATMAP_BANDS.over.moderate - HEATMAP_BANDS.over.slight, // moderate
  HEATMAP_BANDS.over.slight - HEATMAP_BANDS.over.close, // slight
  HEATMAP_BANDS.over.close - HEATMAP_BANDS.over.onTarget, // close
  HEATMAP_BANDS.over.onTarget, // onTarget
] as const;

/** Boundaries of the five legend segments along a 0..1 off→on axis. */
export function heatmapLegendBoundaries(): number[] {
  const total = LEGEND_WIDTHS.reduce((a, b) => a + b, 0);
  const bounds = [0];
  let acc = 0;
  for (const w of LEGEND_WIDTHS) {
    acc += w;
    bounds.push(acc / total);
  }
  return bounds;
}

/**
 * The legend bar's CSS gradient, with explicit stops. Without them the browser
 * spaces the five colours evenly, which claims each covers a fifth of the
 * scale when red only begins past ±50%.
 */
export function heatmapLegendGradient(): string {
  const ramp = [
    HEATMAP_COLORS.far,
    HEATMAP_COLORS.moderate,
    HEATMAP_COLORS.slight,
    HEATMAP_COLORS.close,
    HEATMAP_COLORS.onTarget,
  ];
  const bounds = heatmapLegendBoundaries();
  // Each colour is emitted at BOTH ends of its slice, so the segments have
  // hard edges. A smooth blend implied a continuum the cells do not have.
  const stops = ramp
    .map(
      (c, i) =>
        `${c} ${bounds[i] * 100}%, ${c} ${bounds[i + 1] * 100}%`,
    )
    .join(', ');
  return `linear-gradient(to right, ${stops})`;
}

export function getHeatmapColor(ratio: number | null): {
  bg: string;
  labelKey: string;
} {
  if (ratio === null) return { bg: 'transparent', labelKey: 'noData' };

  const over = ratio > 1;
  const dist = Math.abs(ratio - 1.0);
  // Asymmetric on purpose — see HEATMAP_BANDS.under.
  const b = over ? HEATMAP_BANDS.over : HEATMAP_BANDS.under;
  if (dist <= b.onTarget) {
    return { bg: HEATMAP_COLORS.onTarget, labelKey: 'onTarget' };
  }
  if (dist <= b.close) {
    return { bg: HEATMAP_COLORS.close, labelKey: 'close' };
  }
  if (dist <= b.slight)
    return {
      bg: HEATMAP_COLORS.slight,
      labelKey: over ? 'slightlyOver' : 'slightlyUnder',
    };
  if (dist <= b.moderate)
    return {
      bg: HEATMAP_COLORS.moderate,
      labelKey: over ? 'over' : 'under',
    };
  return {
    bg: HEATMAP_COLORS.far,
    labelKey: over ? 'farOver' : 'farUnder',
  };
}
