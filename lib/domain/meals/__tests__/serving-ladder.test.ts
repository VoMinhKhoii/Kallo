import { describe, expect, it } from 'vitest';
import {
  canStepServingMultiplier,
  formatRawLoggedAmount,
  formatServingTimes,
  formatServingValue,
  MIN_SERVING_MULTIPLIER,
  servingPluralCount,
  stepServingMultiplier,
} from '../serving-ladder';

describe('serving-ladder', () => {
  it('walks the exact sub-1 ladder down and back up, then +0.5 above 1', () => {
    const down: number[] = [];
    let v = 1;
    while (canStepServingMultiplier(v, -1)) {
      v = stepServingMultiplier(v, -1);
      down.push(v);
    }
    expect(down).toEqual([0.75, 2 / 3, 0.5, 1 / 3, 0.25]);
    expect(v).toBe(MIN_SERVING_MULTIPLIER);
    expect(stepServingMultiplier(v, -1)).toBe(0.25);

    const up: number[] = [];
    for (let i = 0; i < 8; i++) {
      v = stepServingMultiplier(v, 1);
      up.push(v);
    }
    expect(up).toEqual([1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2, 2.5]);
  });

  it('snaps off-rung values to the next rung in either direction', () => {
    expect(stepServingMultiplier(0.1, 1)).toBe(0.25);
    expect(stepServingMultiplier(0.3, 1)).toBeCloseTo(1 / 3, 9);
    expect(stepServingMultiplier(0.3, -1)).toBe(0.25);
    expect(stepServingMultiplier(0.4, 1)).toBe(0.5);
    expect(stepServingMultiplier(0.4, -1)).toBeCloseTo(1 / 3, 9);
    expect(stepServingMultiplier(0.6, 1)).toBeCloseTo(2 / 3, 9);
    expect(stepServingMultiplier(0.6, -1)).toBe(0.5);
    expect(stepServingMultiplier(0.8, 1)).toBe(1);
    expect(stepServingMultiplier(0.8, -1)).toBe(0.75);
    expect(stepServingMultiplier(1.06, 1)).toBe(1.5);
    expect(stepServingMultiplier(1.06, -1)).toBe(1);
    expect(stepServingMultiplier(1.475, 1)).toBe(1.5);
  });

  it('honors an upper bound when stepping up', () => {
    expect(canStepServingMultiplier(1.5, 1, 1.6)).toBe(false);
    expect(stepServingMultiplier(1.5, 1, 1.6)).toBe(1.5);
    expect(canStepServingMultiplier(1, 1, 1.6)).toBe(true);
    expect(stepServingMultiplier(1, 1, 1.6)).toBe(1.5);
    expect(canStepServingMultiplier(1, 1, 1)).toBe(false);
    expect(canStepServingMultiplier(1, -1, 1)).toBe(true);
  });

  it('formats thirds as fractions and decimals by locale', () => {
    expect(formatServingValue(0.25, 'en')).toBe('0.25');
    expect(formatServingValue(1 / 3, 'en')).toBe('1/3');
    expect(formatServingValue(0.333, 'en')).toBe('1/3');
    expect(formatServingValue(0.5, 'en')).toBe('0.5');
    expect(formatServingValue(2 / 3, 'en')).toBe('2/3');
    expect(formatServingValue(0.667, 'en')).toBe('2/3');
    expect(formatServingValue(0.75, 'en')).toBe('0.75');
    expect(formatServingValue(1, 'en')).toBe('1');
    expect(formatServingValue(1.5, 'en')).toBe('1.5');

    expect(formatServingValue(0.25, 'vi')).toBe('0,25');
    expect(formatServingValue(1 / 3, 'vi')).toBe('1/3');
    expect(formatServingValue(0.5, 'vi')).toBe('0,5');
    expect(formatServingValue(2 / 3, 'vi')).toBe('2/3');
    expect(formatServingValue(0.75, 'vi')).toBe('0,75');
    expect(formatServingTimes(0.25, 'vi')).toBe('0,25×');
    expect(formatServingTimes(1 / 3, 'vi')).toBe('1/3×');
  });

  it('picks singular up to 1 and plural above 1', () => {
    expect(servingPluralCount(0.25)).toBe(1);
    expect(servingPluralCount(1 / 3)).toBe(1);
    expect(servingPluralCount(0.5)).toBe(1);
    expect(servingPluralCount(1)).toBe(1);
    expect(servingPluralCount(1.5)).toBe(2);
    expect(servingPluralCount(2)).toBe(2);
  });

  it('formats raw logged amounts cleanly for titles', () => {
    expect(formatRawLoggedAmount(330, 'ml')).toBe('330ml');
    expect(formatRawLoggedAmount(100 / 3, 'ml')).toBe('33.33ml');
    expect(formatRawLoggedAmount(1 / 3, 'serving')).toBe('1/3 serving');
    expect(formatRawLoggedAmount(0.5, 'serving')).toBe('0.5 serving');
    expect(formatRawLoggedAmount(1, 'serving')).toBe('1 serving');
    expect(formatRawLoggedAmount(1.5, 'serving')).toBe('1.5 servings');
  });
});
