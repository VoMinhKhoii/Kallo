import { describe, expect, it } from 'vitest';
import {
  dayKeyToUtcDate,
  toLocalCalendarDate,
  toLocalDayKey,
  toUtcDayKey,
} from '@/lib/core/date/day-key';
import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';

describe('toUtcDayKey', () => {
  it('formats the UTC calendar day of an instant', () => {
    expect(toUtcDayKey(new Date('2026-04-06T23:59:59.999Z'))).toBe(
      '2026-04-06'
    );
    expect(toUtcDayKey(new Date('2026-04-07T00:00:00.000Z'))).toBe(
      '2026-04-07'
    );
  });

  it('accepts epoch milliseconds as well as a Date', () => {
    const ms = Date.parse('2026-04-06T12:00:00.000Z');
    expect(toUtcDayKey(ms)).toBe(toUtcDayKey(new Date(ms)));
  });
});

describe('toLocalDayKey — offset sign convention', () => {
  // `timezoneOffset` is Date.getTimezoneOffset() sign: INVERTED from the UTC
  // offset, so UTC+7 is -420 and UTC-5 is +300 (lib/validation/primitives.ts).
  it('treats a NEGATIVE offset as east of UTC (UTC+7 is -420)', () => {
    // 17:00Z is midnight the NEXT day in UTC+7.
    expect(toLocalDayKey(new Date('2026-04-06T17:00:00.000Z'), -420)).toBe(
      '2026-04-07'
    );
    expect(toLocalDayKey(new Date('2026-04-06T16:59:59.999Z'), -420)).toBe(
      '2026-04-06'
    );
  });

  it('treats a POSITIVE offset as west of UTC (UTC-5 is +300)', () => {
    // 04:00Z is still the previous evening in UTC-5.
    expect(toLocalDayKey(new Date('2026-04-07T04:00:00.000Z'), 300)).toBe(
      '2026-04-06'
    );
    expect(toLocalDayKey(new Date('2026-04-07T05:00:00.000Z'), 300)).toBe(
      '2026-04-07'
    );
  });

  it('is the UTC day key at offset 0', () => {
    const instant = new Date('2026-04-06T22:15:00.000Z');
    expect(toLocalDayKey(instant, 0)).toBe(toUtcDayKey(instant));
  });

  it('round-trips with getUtcDayRangeForLocalDate', () => {
    for (const offset of [-840, -420, 0, 300, 720]) {
      const key = '2026-04-07';
      const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(key, offset);
      expect(toLocalDayKey(dayStart, offset)).toBe(key);
      expect(toLocalDayKey(new Date(dayEnd.getTime() - 1), offset)).toBe(key);
      expect(toLocalDayKey(dayEnd, offset)).not.toBe(key);
    }
  });
});

describe('toLocalDayKey — DST-adjacent days', () => {
  // Nothing here reads a zone database: the caller supplies the offset in
  // force at that instant, and the shift is exactly that offset. These cases
  // pin that down, because a zone lookup would answer differently.
  it('honours the offset it is given across a fall-back boundary', () => {
    // US Eastern 2026-11-01: EDT (-04:00, offset 240) ends at 06:00Z.
    const justBefore = new Date('2026-11-01T04:30:00.000Z');
    expect(toLocalDayKey(justBefore, 240)).toBe('2026-11-01');
    // Same instant read with the POST-transition offset (EST, +05:00 → 300)
    // lands on the previous day. Both are correct for their offset.
    expect(toLocalDayKey(justBefore, 300)).toBe('2026-10-31');
  });

  it('honours the offset it is given across a spring-forward boundary', () => {
    // US Eastern 2026-03-08: 07:00Z is 02:00 EST → 03:00 EDT.
    const beforeJump = new Date('2026-03-08T06:30:00.000Z');
    expect(toLocalDayKey(beforeJump, 300)).toBe('2026-03-08');
    const afterJump = new Date('2026-03-08T07:30:00.000Z');
    expect(toLocalDayKey(afterJump, 240)).toBe('2026-03-08');
  });

  it('keeps a half-hour offset zone on its own calendar day', () => {
    // Kolkata is UTC+05:30 → -330. 18:45Z is 00:15 the next day there.
    expect(toLocalDayKey(new Date('2026-03-08T18:45:00.000Z'), -330)).toBe(
      '2026-03-09'
    );
  });
});

describe('toLocalDayKey — date-line extremes', () => {
  it('runs a day ahead at the -840 extreme (UTC+14)', () => {
    expect(toLocalDayKey(new Date('2026-12-31T11:00:00.000Z'), -840)).toBe(
      '2027-01-01'
    );
    expect(toLocalDayKey(new Date('2026-12-31T09:59:59.999Z'), -840)).toBe(
      '2026-12-31'
    );
  });

  it('runs a day behind at the +720 extreme (UTC-12)', () => {
    expect(toLocalDayKey(new Date('2027-01-01T00:00:00.000Z'), 720)).toBe(
      '2026-12-31'
    );
    expect(toLocalDayKey(new Date('2027-01-01T12:00:00.000Z'), 720)).toBe(
      '2027-01-01'
    );
  });

  it('spans two calendar days between the extremes at one instant', () => {
    const instant = new Date('2026-06-15T11:00:00.000Z');
    expect(toLocalDayKey(instant, -840)).toBe('2026-06-16');
    expect(toLocalDayKey(instant, 720)).toBe('2026-06-14');
  });
});

describe('toLocalCalendarDate', () => {
  it('shifts an instant so its UTC fields read as local wall clock', () => {
    const local = toLocalCalendarDate(
      new Date('2026-04-06T17:30:00.000Z'),
      -420
    );
    expect(local.toISOString()).toBe('2026-04-07T00:30:00.000Z');
    expect(local.getUTCFullYear()).toBe(2026);
    expect(local.getUTCMonth()).toBe(3);
    expect(local.getUTCDate()).toBe(7);
    expect(local.getUTCHours()).toBe(0);
    expect(local.getUTCMinutes()).toBe(30);
  });

  it('agrees with toLocalDayKey', () => {
    const instant = new Date('2026-06-15T11:00:00.000Z');
    for (const offset of [-840, -330, 0, 300, 720]) {
      expect(toUtcDayKey(toLocalCalendarDate(instant, offset))).toBe(
        toLocalDayKey(instant, offset)
      );
    }
  });

  it('accepts epoch milliseconds', () => {
    const ms = Date.parse('2026-06-15T11:00:00.000Z');
    expect(toLocalCalendarDate(ms, -420).toISOString()).toBe(
      toLocalCalendarDate(new Date(ms), -420).toISOString()
    );
  });
});

describe('dayKeyToUtcDate', () => {
  it('parses a day key as UTC midnight', () => {
    expect(dayKeyToUtcDate('2026-04-06').toISOString()).toBe(
      '2026-04-06T00:00:00.000Z'
    );
  });

  it('round-trips through toUtcDayKey', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2028-02-29']) {
      expect(toUtcDayKey(dayKeyToUtcDate(key))).toBe(key);
    }
  });
});
