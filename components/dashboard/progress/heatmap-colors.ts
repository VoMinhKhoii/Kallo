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
  onTarget: 0.1,
  close: 0.2,
  slight: 0.35,
  moderate: 0.5,
} as const;

/** The score band for "% on track" — the top two tiers. */
export const HEATMAP_ON_TRACK_BAND = HEATMAP_BANDS.close;

/**
 * Where each colour sits along a 0..1 "off target → on target" axis, derived
 * from the edges above (`1 - dist / moderate`) so every colour occupies its
 * true share of the legend rather than an equal fifth.
 */
export const HEATMAP_LEGEND_STOPS = [
  0,
  (HEATMAP_BANDS.moderate - HEATMAP_BANDS.slight) / HEATMAP_BANDS.moderate / 2,
  1 -
    (HEATMAP_BANDS.slight + HEATMAP_BANDS.close) / 2 / HEATMAP_BANDS.moderate,
  1 -
    (HEATMAP_BANDS.close + HEATMAP_BANDS.onTarget) /
      2 /
      HEATMAP_BANDS.moderate,
  1,
] as const;

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
  const stops = ramp
    .map((c, i) => `${c} ${HEATMAP_LEGEND_STOPS[i] * 100}%`)
    .join(', ');
  return `linear-gradient(to right, ${stops})`;
}

export function getHeatmapColor(ratio: number | null): {
  bg: string;
  labelKey: string;
} {
  if (ratio === null) return { bg: 'transparent', labelKey: 'noData' };

  const dist = Math.abs(ratio - 1.0);
  if (dist <= HEATMAP_BANDS.onTarget) {
    return { bg: HEATMAP_COLORS.onTarget, labelKey: 'onTarget' };
  }
  if (dist <= HEATMAP_BANDS.close) {
    return { bg: HEATMAP_COLORS.close, labelKey: 'close' };
  }
  if (dist <= HEATMAP_BANDS.slight)
    return {
      bg: HEATMAP_COLORS.slight,
      labelKey: ratio > 1 ? 'slightlyOver' : 'slightlyUnder',
    };
  if (dist <= HEATMAP_BANDS.moderate)
    return {
      bg: HEATMAP_COLORS.moderate,
      labelKey: ratio > 1 ? 'over' : 'under',
    };
  return {
    bg: HEATMAP_COLORS.far,
    labelKey: ratio > 1 ? 'farOver' : 'farUnder',
  };
}
