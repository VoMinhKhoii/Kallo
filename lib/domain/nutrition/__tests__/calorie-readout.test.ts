import { describe, expect, it } from 'vitest';
import { calorieReadout } from '@/lib/domain/nutrition/calorie-readout';
import type { Goal } from '@/lib/domain/onboarding/types';

const TARGET = 2000;

describe('calorieReadout', () => {
  it('leads a cutter with what is left to spend', () => {
    expect(calorieReadout(741, TARGET, 'cutting')).toEqual({
      headline: 1259,
      framing: 'remaining',
      left: 1259,
      over: null,
    });
  });

  it.each<Goal | null>([
    'bulking',
    'maintaining',
    null,
  ])('leads %s with what has been logged', (goal) => {
    expect(calorieReadout(741, TARGET, goal)).toMatchObject({
      headline: 741,
      framing: 'logged',
      left: 1259,
    });
  });

  it('never hands a cutter a negative headline', () => {
    const readout = calorieReadout(2341, TARGET, 'cutting');

    expect(readout.headline).toBe(0);
    // The deficit is spent, but the overshoot is not hidden.
    expect(readout.over).toBe(341);
  });

  it('names the overshoot for a goal that counts up', () => {
    expect(calorieReadout(2341, TARGET, 'bulking')).toMatchObject({
      headline: 2341,
      left: 0,
      over: 341,
    });
  });

  it('rounds before it decides, so the two figures always add up', () => {
    const readout = calorieReadout(740.6, TARGET, 'cutting');

    expect(readout.headline).toBe(1259);
    expect(readout.left).toBe(1259);
  });
});
