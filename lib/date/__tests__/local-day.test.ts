import { describe, expect, it } from 'vitest';
import {
  getUtcDayRangeForLocalDate,
  getUtcInstantForLocalDate,
} from '@/lib/date/local-day';

describe('local day timezone helpers', () => {
  it('converts a UTC+7 local day to the correct UTC range', () => {
    const { dayStart, dayEnd } = getUtcDayRangeForLocalDate('2026-04-06', -420);

    expect(dayStart.toISOString()).toBe('2026-04-05T17:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-04-06T17:00:00.000Z');
  });

  it('keeps the current local time on the selected logged date', () => {
    const loggedAt = getUtcInstantForLocalDate(
      '2026-04-06',
      -420,
      new Date('2026-04-08T03:30:15.000Z')
    );

    expect(loggedAt.toISOString()).toBe('2026-04-06T03:30:15.000Z');
  });
});
