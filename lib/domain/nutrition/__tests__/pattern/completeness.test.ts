import { describe, expect, it } from 'vitest';
import {
  classifyDayCompleteness,
  isLikelyPartialDay,
  medianOf,
  PARTIAL_DAY_FRACTION,
} from '@/lib/domain/nutrition/pattern/completeness';

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
        { date: 'c', calories: 400 }, // < 85% of 2000
      ],
      2000
    );

    expect(result.completeDates).toEqual(new Set(['a', 'b']));
    expect(result.partialDates).toEqual(new Set(['c']));
    expect(result.completeDays).toBe(2);
    expect(result.partialDays).toBe(1);
  });

  it('falls back to the median when no target is set', () => {
    // median of [2000, 2200, 1800] is 2000 → floor 1700.
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
    expect(isLikelyPartialDay(400, 2000)).toBe(true); // 400 < 1700
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

describe('marked days', () => {
  it('short-circuits isLikelyPartialDay however far under the floor', () => {
    expect(isLikelyPartialDay(1, 2000, true)).toBe(false);
    expect(isLikelyPartialDay(1, 2000)).toBe(true);
  });

  it('keeps a marked date out of partialDates', () => {
    const days = [
      { date: 'a', calories: 400 },
      { date: 'b', calories: 2000 },
    ];
    const { partialDates, completeDates } = classifyDayCompleteness(
      days,
      2000,
      { markedDates: new Set(['a']) }
    );
    expect(partialDates.has('a')).toBe(false);
    expect(completeDates.has('a')).toBe(true);
    expect(completeDates.has('b')).toBe(true);
  });

  it('leaves unmarked under-logged days partial', () => {
    const days = [
      { date: 'a', calories: 400 },
      { date: 'b', calories: 500 },
      { date: 'c', calories: 2000 },
    ];
    const { partialDates } = classifyDayCompleteness(days, 2000, {
      markedDates: new Set(['a']),
    });
    expect(partialDates.has('a')).toBe(false);
    expect(partialDates.has('b')).toBe(true);
  });

  // The valve promotes every logged day when NONE qualifies. One marked day
  // means one qualifies, so the rest must stay partial — otherwise marking a
  // single day would silently launder every other under-logged day in the
  // window into the averages.
  it('a marked day keeps the safety valve shut for the others', () => {
    const days = [
      { date: 'a', calories: 400 },
      { date: 'b', calories: 500 },
    ];
    expect(classifyDayCompleteness(days, 2000).partialDays).toBe(0);

    const marked = classifyDayCompleteness(days, 2000, {
      markedDates: new Set(['a']),
    });
    expect(marked.completeDays).toBe(1);
    expect(marked.partialDays).toBe(1);
    expect(marked.partialDates.has('b')).toBe(true);
  });

  it('counts a marked day at its real calories, not the target', () => {
    const days = [{ date: 'a', calories: 400 }];
    const { completeDates } = classifyDayCompleteness(days, 2000, {
      markedDates: new Set(['a']),
    });
    // The classifier only ever reports membership; callers average the row's
    // own calories. Guarding that it is reported as complete is what lets the
    // real 400 flow through instead of being dropped.
    expect(completeDates).toEqual(new Set(['a']));
  });
});
