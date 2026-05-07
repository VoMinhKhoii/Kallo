export const HEATMAP_COLORS = {
  onTarget: 'var(--nham-heatmap-on-target)',
  close: 'var(--nham-heatmap-close)',
  slight: 'var(--nham-heatmap-slight)',
  moderate: 'var(--nham-heatmap-moderate)',
  far: 'var(--nham-heatmap-far)',
} as const;

export function getHeatmapColor(ratio: number | null): {
  bg: string;
  labelKey: string;
} {
  if (ratio === null) return { bg: 'transparent', labelKey: 'noData' };

  const dist = Math.abs(ratio - 1.0);
  if (dist <= 0.05) {
    return { bg: HEATMAP_COLORS.onTarget, labelKey: 'onTarget' };
  }
  if (dist <= 0.1) return { bg: HEATMAP_COLORS.close, labelKey: 'close' };
  if (dist <= 0.2)
    return {
      bg: HEATMAP_COLORS.slight,
      labelKey: ratio > 1 ? 'slightlyOver' : 'slightlyUnder',
    };
  if (dist <= 0.3)
    return {
      bg: HEATMAP_COLORS.moderate,
      labelKey: ratio > 1 ? 'over' : 'under',
    };
  return {
    bg: HEATMAP_COLORS.far,
    labelKey: ratio > 1 ? 'farOver' : 'farUnder',
  };
}
