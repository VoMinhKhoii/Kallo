import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '@/lib/date/ms';

describe('MS_PER_DAY', () => {
  it('is a nominal 24-hour day in milliseconds', () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
    expect(MS_PER_DAY).toBe(86_400_000);
  });
});
