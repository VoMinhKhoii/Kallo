import { describe, expect, it } from 'vitest';
import { formatUtcTimestamp } from '../utc-timestamp';

describe('formatUtcTimestamp', () => {
  it('renders a Date as "YYYY-MM-DD HH:MM:SS UTC"', () => {
    expect(formatUtcTimestamp(new Date('2026-08-17T09:30:15.123Z'))).toBe(
      '2026-08-17 09:30:15 UTC'
    );
  });

  it('accepts an ISO string', () => {
    expect(formatUtcTimestamp('2026-01-02T03:04:05Z')).toBe(
      '2026-01-02 03:04:05 UTC'
    );
  });

  it('normalizes a non-UTC offset to UTC', () => {
    expect(formatUtcTimestamp('2026-08-17T09:30:15+07:00')).toBe(
      '2026-08-17 02:30:15 UTC'
    );
  });

  it('drops sub-second precision rather than rounding', () => {
    expect(formatUtcTimestamp(new Date('2026-08-17T09:30:15.999Z'))).toBe(
      '2026-08-17 09:30:15 UTC'
    );
  });
});
