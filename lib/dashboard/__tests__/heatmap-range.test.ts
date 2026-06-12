import { describe, expect, it } from 'vitest';
import {
  chooseDataAgeRange,
  chooseRenderedHeatmapRange,
  firstLoggedDate,
} from '@/lib/dashboard/heatmap-range';
import type { HeatmapCell } from '@/lib/types/dashboard';

const WEEK_COUNT = { '30d': 5, '90d': 14, year: 53 };

function cell(date: string, logged: boolean): HeatmapCell {
  return {
    date,
    ratio: logged ? 0.9 : null,
    consumedRatio: logged ? 0.9 : null,
    status: logged ? 'logged' : 'unlogged',
  };
}

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

describe('firstLoggedDate', () => {
  it('returns null when no cell has a log', () => {
    const cells = [[cell('2026-06-01', false), cell('2026-06-02', false)]];
    expect(firstLoggedDate(cells)).toBeNull();
  });

  it('returns the earliest logged date across columns', () => {
    const cells = [
      [cell('2026-06-01', false), cell('2026-06-03', true)],
      [cell('2026-06-08', true), cell('2026-06-09', false)],
    ];
    expect(firstLoggedDate(cells)).toBe('2026-06-03');
  });
});

describe('chooseDataAgeRange', () => {
  it('holds at 30d for a brand-new user with no logs', () => {
    expect(chooseDataAgeRange(null, '2026-06-12')).toBe('30d');
  });

  it('holds at 30d in the first month of history', () => {
    expect(chooseDataAgeRange('2026-06-01', '2026-06-12')).toBe('30d');
  });

  it('widens to 90d after a month of history', () => {
    expect(chooseDataAgeRange('2026-05-01', '2026-06-12')).toBe('90d');
  });

  it('widens to the full year only after ~90 days', () => {
    expect(chooseDataAgeRange('2026-01-01', '2026-06-12')).toBe('year');
  });
});
