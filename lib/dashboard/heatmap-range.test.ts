import { describe, expect, it } from 'vitest';
import { chooseRenderedHeatmapRange } from './heatmap-range';

const WEEK_COUNT = { '30d': 5, '90d': 14, year: 53 };

describe('chooseRenderedHeatmapRange', () => {
  it('keeps the full year when the viewport can fit it', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 900,
        weekCount: WEEK_COUNT,
      })
    ).toBe('year');
  });

  it('keeps the full year when width fits even if height is compact', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 900,
        availableHeight: 180,
        weekCount: WEEK_COUNT,
      })
    ).toBe('year');
  });

  it('falls back from year to 90 days when the year is too dense', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: 'year',
        availableWidth: 360,
        weekCount: WEEK_COUNT,
      })
    ).toBe('90d');
  });

  it('keeps explicit 30 day preference even on wide screens', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: '30d',
        availableWidth: 900,
        weekCount: WEEK_COUNT,
      })
    ).toBe('30d');
  });
});
