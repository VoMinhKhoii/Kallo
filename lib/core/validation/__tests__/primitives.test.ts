import { describe, expect, it } from 'vitest';
import {
  beforeCursorSchema,
  dateStringSchema,
  isValidCalendarDateString,
  timezoneOffsetSchema,
  uuidSchema,
} from '@/lib/core/validation/primitives';

describe('dateStringSchema', () => {
  it.each([
    '2026-04-24',
    '2024-02-29',
    '2026-12-31',
  ])('accepts the real calendar date %s', (value) => {
    expect(dateStringSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2026-13-01',
    '2025-02-29',
  ])('rejects the impossible date %s', (value) => {
    expect(dateStringSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    '24-04-2026',
    '2026-4-24',
    '2026-04-24T00:00:00Z',
    '',
  ])('rejects the misshapen date %s', (value) => {
    expect(dateStringSchema.safeParse(value).success).toBe(false);
  });

  it('exposes the calendar check on its own', () => {
    expect(isValidCalendarDateString('2026-04-24')).toBe(true);
    expect(isValidCalendarDateString('2026-02-30')).toBe(false);
  });
});

describe('timezoneOffsetSchema', () => {
  // `Date.getTimezoneOffset()` sign, i.e. inverted: UTC+7 is -420, UTC-5 is
  // 300. Real UTC offsets span -12:00..+14:00, so the bounds are -840..720.
  it.each([-840, -420, -330, 0, 330, 720])('accepts %i', (value) => {
    expect(timezoneOffsetSchema.safeParse(value).success).toBe(true);
  });

  it.each([-1440, -841, 721, 1440])('rejects out-of-range %i', (value) => {
    expect(timezoneOffsetSchema.safeParse(value).success).toBe(false);
  });

  it('rejects non-integer minutes', () => {
    expect(timezoneOffsetSchema.safeParse(-419.5).success).toBe(false);
  });
});

describe('uuidSchema', () => {
  const upper = '11111111-1111-4111-8111-AAAAAAAAAAAA';

  it('accepts a uuid and lowercases it', () => {
    const result = uuidSchema.safeParse(upper);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(upper.toLowerCase());
    }
  });

  it.each([
    '',
    'not-a-uuid',
    '11111111-1111-4111-8111',
  ])('rejects %s', (value) => {
    expect(uuidSchema.safeParse(value).success).toBe(false);
  });
});

describe('beforeCursorSchema', () => {
  it('accepts an absent cursor', () => {
    expect(beforeCursorSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts an ISO timestamp (legacy Flutter clients)', () => {
    expect(
      beforeCursorSchema.safeParse('2026-04-05T17:30:00.000Z').success
    ).toBe(true);
  });

  it('rejects an empty cursor and an oversized one', () => {
    expect(beforeCursorSchema.safeParse('').success).toBe(false);
    expect(beforeCursorSchema.safeParse('a'.repeat(501)).success).toBe(false);
  });
});
