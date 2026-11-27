/**
 * The serving-multiplier ladder shared by Scan (servings & packs) and Edit
 * Meal (Whole meal & per-dish Servings):
 *
 *   0.25, 1/3, 0.5, 2/3, 0.75, 1, 1.5, 2, 2.5, ...
 *
 * Below 1 it hits the fractions people actually split a serving or pack into
 * (halves, thirds, quarters); from 1 upward it moves in halves. The Dart twin
 * is `apps/mobile-flutter/lib/features/logging/logic/serving_ladder.dart` —
 * keep the two in step.
 */

/** Fractions below 1, in ascending order. */
export const SUB_ONE_SERVING_STEPS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75] as const;

/** The lowest rung on the ladder (one quarter). */
export const MIN_SERVING_MULTIPLIER = SUB_ONE_SERVING_STEPS[0];

/** Step size from 1 upward: 1, 1.5, 2, 2.5, ... */
export const SERVING_STEP_ABOVE_ONE = 0.5;

/** Float slack for comparing against ladder rungs. */
const EPS = 1e-6;

/** Display tolerance for matching 1/3 and 2/3 (also catches 0.33 / 0.67 after
 *  rounding to hundredths). */
const THIRD_DISPLAY_EPS = 0.005;

const SUB_AND_ONE_STEPS = [...SUB_ONE_SERVING_STEPS, 1] as const;

/** The next rung up from `current`, or `current` when `max` stops it. */
function stepUp(current: number, max?: number): number {
  let candidate: number | undefined;
  for (const rung of SUB_AND_ONE_STEPS) {
    if (rung > current + EPS) {
      candidate = rung;
      break;
    }
  }
  if (candidate === undefined) {
    const steps = current / SERVING_STEP_ABOVE_ONE;
    candidate = (Math.floor(steps + EPS) + 1) * SERVING_STEP_ABOVE_ONE;
  }
  if (max !== undefined && candidate > max + EPS) return current;
  return candidate;
}

/** The next rung down from `current`, held at {@link MIN_SERVING_MULTIPLIER}. */
function stepDown(current: number): number {
  if (current > 1 + EPS) {
    const steps = current / SERVING_STEP_ABOVE_ONE;
    return (Math.ceil(steps - EPS) - 1) * SERVING_STEP_ABOVE_ONE;
  }
  for (let i = SUB_ONE_SERVING_STEPS.length - 1; i >= 0; i--) {
    const rung = SUB_ONE_SERVING_STEPS[i];
    if (rung < current - EPS) return rung;
  }
  return MIN_SERVING_MULTIPLIER;
}

/** Step `current` one rung up (`+1`) or down (`-1`), honoring an optional
 *  upper bound `max`. Off-rung values snap to the next rung in `direction`. */
export function stepServingMultiplier(
  current: number,
  direction: 1 | -1,
  max?: number
): number {
  return direction > 0 ? stepUp(current, max) : stepDown(current);
}

/** Whether stepping `current` in `direction` moves to another rung. */
export function canStepServingMultiplier(
  current: number,
  direction: 1 | -1,
  max?: number
): boolean {
  if (direction < 0) return current > MIN_SERVING_MULTIPLIER + EPS;
  const next = stepUp(current, max);
  return next > current + EPS;
}

/** Plural category helper for serving/pack counts: sub-1 fractions and 1 read
 *  singular ("0.5 serving", "1/3 pack", "1 serving"); anything above 1 reads
 *  plural ("1.5 servings", "2 packs"). */
export function servingPluralCount(value: number): 1 | 2 {
  return value > 1 + EPS ? 2 : 1;
}

/** Format a serving count or multiplier: thirds print as `"1/3"` / `"2/3"`,
 *  everything else as a locale decimal with up to two fraction digits
 *  (`0.25`, `0.5`, `0.75`, `1`, `1.5` in `en`; `0,25`, `0,5`, `0,75` in `vi`). */
export function formatServingValue(value: number, locale: string): string {
  if (Math.abs(value - 1 / 3) < THIRD_DISPLAY_EPS) return '1/3';
  if (Math.abs(value - 2 / 3) < THIRD_DISPLAY_EPS) return '2/3';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Multiplier readout for Edit Meal: `0.25×`, `1/3×`, `0.5×`, `1.5×`, `2×`. */
export function formatServingTimes(value: number, locale: string): string {
  return `${formatServingValue(value, locale)}×`;
}

/** Compact logged amount for `rawInput` titles on staged barcode/label meals,
 *  so `1/3` serving or `33.3333...ml` never prints raw float tails. */
export function formatRawLoggedAmount(
  amount: number,
  unit: 'g' | 'ml' | 'serving'
): string {
  if (unit === 'serving') {
    const word = servingPluralCount(amount) === 1 ? 'serving' : 'servings';
    return `${formatServingValue(amount, 'en')} ${word}`;
  }
  return `${Math.round(amount * 100) / 100}${unit}`;
}
