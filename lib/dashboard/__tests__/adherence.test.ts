import { describe, expect, it } from 'vitest';
import {
  buildCalorieAdherenceHeatmap,
  buildCalorieAdherenceHeatmapData,
  getLocalDateKey,
} from '@/lib/dashboard/adherence';

describe('getLocalDateKey', () => {
  it('converts UTC instants into the user local date', () => {
    expect(getLocalDateKey(new Date('2026-04-22T18:00:00.000Z'), -420)).toBe(
      '2026-04-23'
    );
  });
});

describe('buildCalorieAdherenceHeatmap', () => {
  it('maps daily calories to target ratios in Monday-first rows', () => {
    const heatmap = buildCalorieAdherenceHeatmap({
      range: '30d',
      timezoneOffset: 0,
      calorieTarget: 2000,
      now: new Date('2026-04-23T12:00:00.000Z'),
      dailyCalories: [
        { date: '2026-04-21', calories: 1800 },
        { date: '2026-04-22', calories: 2000 },
        { date: '2026-04-23', calories: 2400 },
      ],
    });

    expect(heatmap).toHaveLength(7);
    expect(heatmap[0]).toHaveLength(5);
    expect(heatmap[1][4]).toBe(0.9);
    expect(heatmap[2][4]).toBe(1);
    expect(heatmap[3][4]).toBe(1.2);
  });

  it('leaves missing log days and missing targets empty', () => {
    const heatmap = buildCalorieAdherenceHeatmap({
      range: '30d',
      timezoneOffset: 0,
      calorieTarget: null,
      now: new Date('2026-04-23T12:00:00.000Z'),
      dailyCalories: [{ date: '2026-04-23', calories: 2000 }],
    });

    expect(heatmap.flat().every((value) => value === null)).toBe(true);
  });

  it('marks under-logged days as partial and leaves their ratio empty', () => {
    const data = buildCalorieAdherenceHeatmapData({
      range: '30d',
      timezoneOffset: 0,
      calorieTarget: 2000,
      now: new Date('2026-04-23T12:00:00.000Z'),
      dailyCalories: [
        { date: '2026-04-22', calories: 2000 },
        { date: '2026-04-23', calories: 400 }, // < 50% of target
      ],
    });

    expect(data.cells[2][4]).toMatchObject({
      date: '2026-04-22',
      status: 'logged',
      ratio: 1,
    });
    expect(data.cells[3][4]).toMatchObject({
      date: '2026-04-23',
      status: 'partial',
      ratio: null,
    });
  });

  it('builds year heatmap data with future and outside padding cells', () => {
    const heatmap = buildCalorieAdherenceHeatmapData({
      range: 'year',
      timezoneOffset: 0,
      calorieTarget: 2000,
      now: new Date('2026-04-23T12:00:00.000Z'),
      dailyCalories: [{ date: '2026-04-23', calories: 2000 }],
    });

    expect(heatmap.cells).toHaveLength(7);
    expect(heatmap.monthHeaders.at(0)?.month).toBe('Jan');
    expect(heatmap.monthHeaders.some((header) => header.month === 'Apr')).toBe(
      true
    );
    expect(heatmap.cells[0][0].status).toBe('outside');
    expect(heatmap.cells[3][16]).toMatchObject({
      date: '2026-04-23',
      ratio: 1,
      status: 'logged',
    });
    expect(heatmap.cells.flat().some((cell) => cell.status === 'future')).toBe(
      true
    );
  });
});
