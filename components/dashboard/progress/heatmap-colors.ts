export const HEATMAP_COLORS = {
  onTarget: 'var(--kallo-heatmap-on-target)',
  close: 'var(--kallo-heatmap-close)',
  slight: 'var(--kallo-heatmap-slight)',
  moderate: 'var(--kallo-heatmap-moderate)',
  far: 'var(--kallo-heatmap-far)',
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

/**
 * The legend bar's CSS gradient: five EQUAL discrete segments, one per tier,
 * each colour emitted at both ends of its slice so the edges are hard.
 *
 * Equal on purpose, and kept identical to the Dart twin's `legendStops`. A
 * legend is a key — it names the vocabulary, it does not measure anything.
 * Sizing the slices to the bands' widths gave the two warm tiers half the bar,
 * which reads as "most of your days are bad" before a cell is drawn; and with
 * the bands now asymmetric there is no single width to be proportional to.
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
    .map((c, i) => `${c} ${i * 20}%, ${c} ${(i + 1) * 20}%`)
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
