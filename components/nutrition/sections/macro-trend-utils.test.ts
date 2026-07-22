import { describe, expect, it } from 'vitest';
import type {
  DaySeriesBucket,
  NutrientDaySeries,
  NutritionDaySeries,
} from '@/lib/nutrition/types';
import {
  buildMacroTrendAxis,
  buildMacroTrendData,
  formatBucketLabel,
} from './macro-trend-utils';

function bucket(startDate: string, value: number | null): DaySeriesBucket {
  return { startDate, endDate: startDate, value, ratioOfTarget: null };
}

function series(
  metric: NutrientDaySeries['metric'],
  values: (number | null)[]
): NutrientDaySeries {
  return {
    metric,
    labelKey: `nutrition.macros.${metric}`,
    unit: 'g',
    target: null,
    buckets: values.map((v, i) => bucket(`2026-05-0${i + 1}`, v)),
    min: null,
    max: null,
  };
}

function daySeries(
  unit: NutritionDaySeries['unit'],
  seriesList: NutrientDaySeries[]
): NutritionDaySeries {
  return { unit, series: seriesList };
}

describe('buildMacroTrendAxis', () => {
  it('keeps a 500 step for a 3000 axis (maxY 2000)', () => {
    const axis = buildMacroTrendAxis(2000);
    expect(axis.step).toBe(500);
    expect(axis.maxLabel).toBe(3000);
    expect(axis.topY).toBe(3175);
    expect(axis.ticks).toEqual([500, 1000, 1500, 2000, 2500, 3000]);
  });

  it('steps up to 1000 when the range grows (maxY 3200)', () => {
    const axis = buildMacroTrendAxis(3200);
    expect(axis.step).toBe(1000);
    expect(axis.maxLabel).toBe(4000);
  });

  it('falls back to a 2500 step for very high intake (maxY 16000)', () => {
    const axis = buildMacroTrendAxis(16000);
    expect(axis.step).toBe(2500);
    expect(axis.maxLabel).toBe(17500);
  });
});

describe('buildMacroTrendData', () => {
  it('returns null for fewer than two buckets', () => {
    const data = buildMacroTrendData(
      daySeries('day', [series('protein', [100])])
    );
    expect(data).toBeNull();
  });

  it('returns null when every bucket is zero/null (maxY <= 0)', () => {
    const data = buildMacroTrendData(
      daySeries('day', [series('protein', [null, 0])])
    );
    expect(data).toBeNull();
  });

  it('coerces null bucket values to 0 and computes kcal per gram', () => {
    const data = buildMacroTrendData(
      daySeries('day', [
        series('protein', [100, null]),
        series('carbohydrate', [200, 50]),
        series('fat', [null, 20]),
      ])
    );
    expect(data).not.toBeNull();
    const points = data?.points;
    // Bucket 0: 100*4 + 200*4 + 0*9
    expect(points?.[0]).toMatchObject({
      protein: 400,
      carbohydrate: 800,
      fat: 0,
    });
    // Bucket 1: 0*4 + 50*4 + 20*9
    expect(points?.[1]).toMatchObject({
      protein: 0,
      carbohydrate: 200,
      fat: 180,
    });
  });

  it('reports maxY as the tallest stacked bucket total', () => {
    const data = buildMacroTrendData(
      daySeries('day', [
        series('protein', [100, 50]),
        series('carbohydrate', [200, 50]),
        series('fat', [10, 10]),
      ])
    );
    // Bucket 0 total: 400 + 800 + 90 = 1290; bucket 1: 200 + 200 + 90 = 490
    expect(data?.maxY).toBe(1290);
  });

  it('falls back to whichever macro series is present for the bucket axis', () => {
    const data = buildMacroTrendData(
      daySeries('day', [series('fat', [10, 20, 30])])
    );
    expect(data?.points).toHaveLength(3);
    expect(data?.points[2].fat).toBe(270);
  });
});

describe('formatBucketLabel', () => {
  it('formats week buckets as d/M with no zero-pad', () => {
    expect(formatBucketLabel('2026-05-03', 'week', 'en')).toBe('3/5');
  });

  it('formats day buckets as the localized weekday initial', () => {
    // 2026-05-03 is a Sunday.
    expect(formatBucketLabel('2026-05-03', 'day', 'en')).toBe('S');
  });

  it('parses as local midnight so the day does not shift under UTC', () => {
    // A UTC parse of the bare date would land on the previous day in western
    // timezones; local parse keeps the 3rd (Sunday) → "S".
    expect(formatBucketLabel('2026-05-03', 'day', 'en')).toBe('S');
  });
});
