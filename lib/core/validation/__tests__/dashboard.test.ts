import { describe, expect, it } from 'vitest';
import { heatmapRangeSchema } from '@/lib/core/validation/dashboard';

describe('heatmapRangeSchema', () => {
  it.each([
    'year',
    '30d',
    '90d',
    '143d',
    '1d',
    '371d',
  ])('accepts %s', (range) => {
    expect(heatmapRangeSchema.safeParse(range).success).toBe(true);
  });

  it.each([
    '0d',
    '372d',
    '1.5d',
    '-7d',
    '90',
    'week',
    ' 90d',
  ])('rejects %s', (range) => {
    expect(heatmapRangeSchema.safeParse(range).success).toBe(false);
  });
});
