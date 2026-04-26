import { describe, expect, it } from 'vitest';
import { getMsUntilNextLocalMidnight } from '@/lib/dashboard/heatmap-rollover';

describe('getMsUntilNextLocalMidnight', () => {
  it('returns the remaining milliseconds until local midnight', () => {
    const now = new Date(2026, 3, 26, 12, 30, 15, 250);

    expect(getMsUntilNextLocalMidnight(now)).toBe(41_384_750);
  });

  it('returns a one-second delay when one second before midnight', () => {
    const now = new Date(2026, 3, 26, 23, 59, 59, 0);

    expect(getMsUntilNextLocalMidnight(now)).toBe(1_000);
  });
});
