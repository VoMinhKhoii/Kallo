/**
 * Nutrient-row status logic vendored from web `components/nutrition/rows/
 * nutrient-row.tsx` + `nutrient-detail.tsx` (keep in sync). `STATUS_COLORS`
 * maps the web's `var(--nham-heatmap-*)` to the mobile heatmap tokens (the
 * canonical light-theme values; the web's inline fallback hexes are dead).
 */
import type { NutrientCardData } from '@/lib/nutrition/types';
import { colors } from '~/theme/tokens';

export const STATUS_COLORS = {
  on_target: colors.heatmap.onTarget,
  close: colors.heatmap.close,
  slight: colors.heatmap.slight,
  moderate: colors.heatmap.moderate,
  far: colors.heatmap.far,
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export function statusKeyFor(card: NutrientCardData): StatusKey {
  if (card.percentOfTarget === null) return 'slight';
  const pct = card.percentOfTarget;
  const type = card.nutrientType;

  if (type === 'floor') {
    if (pct >= 90) return 'on_target';
    if (pct >= 70) return 'close';
    if (pct >= 50) return 'slight';
    if (pct >= 30) return 'moderate';
    return 'far';
  }

  if (type === 'ceiling') {
    if (pct > 100) return 'far';
    if (pct >= 90) return 'on_target';
    if (pct >= 70) return 'close';
    if (pct >= 50) return 'slight';
    return 'moderate';
  }

  // range: ±10% green, ±20% close, ±30% slight, beyond → moderate/far
  const delta = Math.abs(pct - 100);
  if (delta <= 10) return 'on_target';
  if (delta <= 20) return 'close';
  if (delta <= 30) return 'slight';
  if (delta <= 50) return 'moderate';
  return 'far';
}

/**
 * Whether the steady-detail panel shows food-source chips: supported nutrient,
 * decent confidence, and meaningfully below target (<90%). Same thresholds as
 * the spotlight partition.
 */
export function showChips(card: NutrientCardData): boolean {
  return (
    card.supportsCandidates &&
    card.confidence >= 40 &&
    card.percentOfTarget !== null &&
    card.percentOfTarget < 90
  );
}
