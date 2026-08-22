import type {
  ConfidenceDisplayState,
  NutrientType,
} from '@/lib/domain/nutrition/types';

/**
 * Whether a card's coverage is too thin to state a verdict — it mutes the
 * figure and withholds the green "on target" tier.
 *
 * This is the SAME 40% coverage line the server's `getNutrientStatus` uses, not
 * the wider `limited_data` band. `getConfidenceDisplayState` labels 40–70%
 * coverage `limited_data`, but that band still shows a full, trustworthy
 * percentage — so treating it as unverdictable made a nutrient that clearly
 * cleared its floor (niacin at 106%) render grey while announcing 106%. The
 * card said "enough" and looked like "not enough".
 */
export function isLowConfidence(state: ConfidenceDisplayState): boolean {
  return state === 'warning_points' || state === 'insufficient_data';
}

/**
 * Whether a nutrient with the given type & % of target should render the
 * coral exceed indicator (red bg, +N% red figure, coral end-tick).
 *
 * - floor: never (above 100% on a minimum is good — RDAs are floors).
 * - ceiling: above 100% (e.g. sodium).
 * - range: outside ±10% band (e.g. calories on maintenance).
 */
export function shouldShowExceed(
  type: NutrientType,
  pct: number | null
): boolean {
  if (pct === null) return false;
  if (type === 'floor') return false;
  if (type === 'ceiling') return pct > 100;
  if (type === 'range') return pct > 110 || pct < 90;
  return false;
}
