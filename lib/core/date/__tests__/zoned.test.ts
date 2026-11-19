import { describe, expect, it } from 'vitest';
import { shiftDayKey } from '@/lib/core/date/day-key';
import {
  isValidTimeZone,
  zonedClock,
  zonedDayRange,
} from '@/lib/core/date/zoned';

const HOUR = 60 * 60 * 1000;

describe('zonedClock', () => {
  it('reads the wall clock in the zone, not in UTC', () => {
    // 2026-11-04T02:30Z is 09:30 in Ho Chi Minh City (+7).
    expect(
      zonedClock(new Date('2026-11-04T02:30:00Z'), 'Asia/Ho_Chi_Minh')
    ).toEqual({ date: '2026-11-04', minuteOfDay: 9 * 60 + 30 });
  });

  it('crosses the date line the zone is on', () => {
    // 23:00Z on the 3rd is already 08:00 on the 4th in Tokyo.
    expect(zonedClock(new Date('2026-11-03T23:00:00Z'), 'Asia/Tokyo')).toEqual({
      date: '2026-11-04',
      minuteOfDay: 8 * 60,
    });
  });

  it('handles half-hour zones', () => {
    // Kolkata is +5:30: 04:30Z → 10:00.
    expect(
      zonedClock(new Date('2026-11-04T04:30:00Z'), 'Asia/Kolkata').minuteOfDay
    ).toBe(10 * 60);
  });

  it('follows daylight saving time', () => {
    // New York: EDT (-4) in July, EST (-5) in December.
    expect(
      zonedClock(new Date('2026-07-01T14:00:00Z'), 'America/New_York')
        .minuteOfDay
    ).toBe(10 * 60);
    expect(
      zonedClock(new Date('2026-12-01T15:00:00Z'), 'America/New_York')
        .minuteOfDay
    ).toBe(10 * 60);
  });
});

describe('zonedDayRange', () => {
  it('is 24 hours on an ordinary day', () => {
    const { dayStart, dayEnd } = zonedDayRange(
      '2026-11-04',
      'Asia/Ho_Chi_Minh'
    );
    expect(dayStart.toISOString()).toBe('2026-11-03T17:00:00.000Z');
    expect(dayEnd.getTime() - dayStart.getTime()).toBe(24 * HOUR);
  });

  it('is 23 hours when the clocks spring forward', () => {
    const { dayStart, dayEnd } = zonedDayRange(
      '2026-03-08',
      'America/New_York'
    );
    expect(dayStart.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('starts a day whose midnight DST skips at its first real instant', () => {
    // Santiago springs from 23:59:59 (-4) to 01:00 (-3) on 6 Sep 2026: no
    // instant reads 00:00 that day.
    const { dayStart } = zonedDayRange('2026-09-06', 'America/Santiago');
    expect(dayStart.toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(zonedClock(dayStart, 'America/Santiago').date).toBe('2026-09-06');
    expect(
      zonedClock(new Date(dayStart.getTime() - 1000), 'America/Santiago').date
    ).toBe('2026-09-05');
  });

  it('is 25 hours when the clocks fall back', () => {
    const { dayStart, dayEnd } = zonedDayRange(
      '2026-11-01',
      'America/New_York'
    );
    expect(dayStart.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(dayEnd.getTime() - dayStart.getTime()).toBe(25 * HOUR);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('shiftDayKey', () => {
  it('moves across month and year ends', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});
