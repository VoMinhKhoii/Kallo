import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HeatmapCell } from '@/lib/core/types/dashboard';
import { useHeatmapDayLabel } from '../heatmap-day-label';

const BASE: HeatmapCell = {
  date: '2026-10-20',
  ratio: null,
  consumedRatio: null,
  calories: null,
  status: 'unlogged',
};

function labelOf(cell: HeatmapCell) {
  const { result } = renderHook(() => useHeatmapDayLabel());
  return result.current(cell);
}

describe('useHeatmapDayLabel', () => {
  it('heads an awaiting day with its date and kcal', () => {
    expect(labelOf({ ...BASE, status: 'partial', calories: 1240.4 })).toEqual({
      heading: 'Tue, Oct 20 · kcal',
      status: 'partial',
    });
  });

  it('names a logged day by its tier, with no percentage', () => {
    expect(
      labelOf({ ...BASE, status: 'logged', ratio: 0.43, calories: 828 })
    ).toEqual({ heading: 'Tue, Oct 20 · kcal', status: 'light' });
  });

  it('shows only the date on a day with nothing logged', () => {
    expect(labelOf(BASE)).toEqual({
      heading: 'Tue, Oct 20',
      status: 'notLogged',
    });
  });
});
