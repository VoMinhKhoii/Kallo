import { describe, expect, it } from 'vitest';
import { bucketForHour, isLateNight } from '@/lib/core/date/time-of-day';

describe('the time-of-day buckets', () => {
  it('runs the day through its buckets in order', () => {
    expect(bucketForHour(5)).toBe('morning');
    expect(bucketForHour(10)).toBe('morning');
    expect(bucketForHour(11)).toBe('lunch');
    expect(bucketForHour(14)).toBe('lunch');
    expect(bucketForHour(15)).toBe('afternoon');
    expect(bucketForHour(17)).toBe('afternoon');
    expect(bucketForHour(18)).toBe('evening');
    expect(bucketForHour(21)).toBe('evening');
  });

  it('wraps late night around midnight', () => {
    // The one bucket that is not a contiguous range: 22:00 through to the
    // start of breakfast.
    expect(bucketForHour(22)).toBe('lateNight');
    expect(bucketForHour(23)).toBe('lateNight');
    expect(bucketForHour(0)).toBe('lateNight');
    expect(bucketForHour(4)).toBe('lateNight');
  });

  it('calls only that stretch late night', () => {
    expect(isLateNight(21)).toBe(false);
    expect(isLateNight(22)).toBe(true);
    expect(isLateNight(4)).toBe(true);
    expect(isLateNight(5)).toBe(false);
  });
});
