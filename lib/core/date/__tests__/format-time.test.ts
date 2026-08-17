import { describe, expect, it } from 'vitest';
import { formatTime } from '@/lib/core/date/format-time';

// Dates are built from LOCAL components on purpose: `toLocaleTimeString`
// renders in the runtime zone, so this keeps the expectations true whatever
// TZ the test machine is in.
const afternoon = new Date(2026, 3, 6, 14, 30, 45);
const morning = new Date(2026, 3, 6, 9, 5, 0);

describe('formatTime', () => {
  it('renders a zero-padded 24-hour clock label', () => {
    expect(formatTime(afternoon, 'en-GB')).toBe('14:30');
    expect(formatTime(morning, 'en-GB')).toBe('09:05');
    expect(formatTime(afternoon, 'vi')).toBe('14:30');
  });

  it('follows the locale onto a 12-hour clock', () => {
    expect(formatTime(afternoon, 'en-US')).toMatch(/^02:30\s?PM$/);
    expect(formatTime(morning, 'en-US')).toMatch(/^09:05\s?AM$/);
  });

  it('drops seconds', () => {
    expect(formatTime(new Date(2026, 3, 6, 14, 30, 0), 'en-GB')).toBe(
      formatTime(afternoon, 'en-GB')
    );
  });

  it('accepts an ISO string or epoch milliseconds for the same instant', () => {
    expect(formatTime(afternoon.toISOString(), 'en-GB')).toBe('14:30');
    expect(formatTime(afternoon.getTime(), 'en-GB')).toBe('14:30');
  });
});
