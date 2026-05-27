import { describe, expect, it } from 'vitest';
import {
  classifyDayCompleteness,
  isLikelyPartialDay,
  medianOf,
  PARTIAL_DAY_FRACTION,
} from '@/lib/nutrition/pattern/completeness';

describe('medianOf', () => {
  it('returns 0 for an empty list', () => {
    expect(medianOf([])).toBe(0);
  });

  it('averages the two middle values for even-length lists', () => {
    expect(medianOf([10, 30, 20, 40])).toBe(25);
  });

  it('returns the middle value for odd-length lists', () => {
    expect(medianOf([5, 100, 10])).toBe(10);
  });
});

describe('classifyDayCompleteness', () => {
  it('splits complete vs partial against the calorie target', () => {
    const result = classifyDayCompleteness(
      [
        { date: 'a', calories: 2000 },
        { date: 'b', calories: 1800 },
        { date: 'c', calories: 400 }, // < 50% of 2000
      ],
      2000
    );

    expect(result.completeDates).toEqual(new Set(['a', 'b']));
    expect(result.partialDates).toEqual(new Set(['c']));
    expect(result.completeDays).toBe(2);
    expect(result.partialDays).toBe(1);
  });

  it('falls back to the median when no target is set', () => {
    // median of [2000, 2200, 1800] is 2000 → floor 1000.
    const result = classifyDayCompleteness(
      [
        { date: 'a', calories: 2000 },
        { date: 'b', calories: 2200 },
        { date: 'c', calories: 1800 },
        { date: 'd', calories: 300 },
      ],
      null
    );

    expect(result.partialDates).toEqual(new Set(['d']));
    expect(result.completeDays).toBe(3);
  });

  it('treats all days as complete when every day would be partial (safety valve)', () => {
    const result = classifyDayCompleteness(
      [
        { date: 'a', calories: 300 },
        { date: 'b', calories: 200 },
      ],
      2000
    );

    expect(result.partialDays).toBe(0);
    expect(result.completeDays).toBe(2);
    expect(result.completeDates).toEqual(new Set(['a', 'b']));
  });

  it('ignores zero-calorie days', () => {
    const result = classifyDayCompleteness(
      [
        { date: 'a', calories: 2000 },
        { date: 'b', calories: 0 },
      ],
      2000
    );

    expect(result.completeDates).toEqual(new Set(['a']));
    expect(result.partialDates.size).toBe(0);
  });

  it('returns an empty classification when nothing is logged', () => {
    const result = classifyDayCompleteness([], 2000);

    expect(result.completeDays).toBe(0);
    expect(result.partialDays).toBe(0);
  });

  it('keeps a day exactly at the threshold as complete', () => {
    const floor = PARTIAL_DAY_FRACTION * 2000;
    const result = classifyDayCompleteness(
      [
        { date: 'a', calories: floor },
        { date: 'b', calories: floor - 1 },
      ],
      2000
    );

    expect(result.completeDates).toEqual(new Set(['a']));
    expect(result.partialDates).toEqual(new Set(['b']));
  });
});

describe('isLikelyPartialDay', () => {
  it('flags a day below the target floor', () => {
    expect(isLikelyPartialDay(400, 2000)).toBe(true); // 400 < 1000
  });

  it('flags a lone partial day (no safety valve unlike the classifier)', () => {
    // classifyDayCompleteness would flip this single under-logged day back to
    // complete; the per-day check keeps it partial.
    expect(isLikelyPartialDay(300, 2000)).toBe(true);
    expect(
      classifyDayCompleteness([{ date: 'a', calories: 300 }], 2000).partialDays
    ).toBe(0);
  });

  it('keeps a day at or above the floor as complete', () => {
    const floor = PARTIAL_DAY_FRACTION * 2000;
    expect(isLikelyPartialDay(floor, 2000)).toBe(false);
    expect(isLikelyPartialDay(floor - 1, 2000)).toBe(true);
  });

  it('returns false when no target is set', () => {
    expect(isLikelyPartialDay(400, null)).toBe(false);
    expect(isLikelyPartialDay(400, 0)).toBe(false);
  });

  it('returns false for an empty day', () => {
    expect(isLikelyPartialDay(0, 2000)).toBe(false);
  });
});
