import type { Goal } from '@/lib/domain/onboarding/types';

/**
 * What the day's calorie figure says, decided from the user's goal alone.
 *
 * WHICH figure is the headline depends on the goal. Cutting counts DOWN — what
 * is left is the number they act on — and everyone else counts UP, because a
 * bulking or maintaining user is trying to reach a figure, not stay under one.
 * Both numbers are always available to the caller; only the hierarchy moves, so
 * a dial drawn from this never shifts its layout when a user changes goal.
 *
 * A cutter is never shown a negative: past target the headline reads 0 and the
 * overshoot is carried by `over`. The deficit is spent, and "−341 remaining" is
 * a riddle where "0" is a fact.
 *
 * Pure, and deliberately free of copy: this is the RULE, and how wordy a
 * surface renders it is that surface's business. Flutter counterpart:
 * `calorieReadout` in `shared/logic/calorie_readout.dart`.
 */

/** Which of the day's two figures the headline is. */
export type CalorieFraming = 'remaining' | 'logged';

export interface CalorieReadout {
  /** The figure to lead with, never negative. */
  headline: number;
  framing: CalorieFraming;
  /** The other figure: what is left to spend, floored at 0. */
  left: number;
  /** How far past target, or null when the day is still under it. */
  over: number | null;
}

export function calorieReadout(
  logged: number,
  target: number,
  goal: Goal | null
): CalorieReadout {
  const remaining = Math.round(target - logged);
  const over = remaining < 0 ? -remaining : null;
  const left = Math.max(0, remaining);

  return goal === 'cutting'
    ? { headline: left, framing: 'remaining', left, over }
    : { headline: Math.round(logged), framing: 'logged', left, over };
}
