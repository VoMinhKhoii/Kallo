/**
 * Vendored from components/dashboard/progress/heatmap-colors.ts — keep in sync.
 *
 * Pure, zero-import helper. The ONLY change for mobile: HEATMAP_COLORS holds
 * resolved light-theme hex values instead of the web's `var(--…)` CSS strings,
 * which do not resolve in React Native. These hex values mirror
 * `~/theme/tokens` `colors.heatmap` exactly.
 */
export const HEATMAP_COLORS = {
  onTarget: '#7ca368',
  close: '#a6c495',
  slight: '#d4c9ad',
  moderate: '#e09c84',
  far: '#d37b69',
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
