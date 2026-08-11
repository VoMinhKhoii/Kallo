import { describe, expect, it } from 'vitest';
import type {
  DaySeriesBucket,
  NutrientDaySeries,
  NutritionDaySeries,
} from '@/lib/nutrition/types';
import { buildBucketDetail, formatBucketRange } from './bucket-detail-utils';

function series(
  metric: NutrientDaySeries['metric'],
  values: (number | null)[],
  { target = null as number | null, unit = 'g' } = {}
): NutrientDaySeries {
  const buckets: DaySeriesBucket[] = values.map((value, i) => {
    const date = `2026-05-0${i + 1}`;
    return {
      startDate: date,
      endDate: date,
      value,
      ratioOfTarget:
        value !== null && target !== null && target > 0 ? value / target : null,
    };
  });
  return {
    metric,
    labelKey: `nutrition.macros.${metric}`,
    unit,
    target,
    buckets,
    min: null,
    max: null,
  };
}

function daySeries(list: NutrientDaySeries[]): NutritionDaySeries {
  return { unit: 'day', series: list };
}

describe('buildBucketDetail', () => {
  it('splits the bucket into macros and micronutrients', () => {
    const detail = buildBucketDetail(
      daySeries([
        series('calories', [2000, 1500], { target: 2000, unit: 'kcal' }),
        series('protein', [100, 80], { target: 100 }),
        series('calciumMg', [500, 400], { target: 1000, unit: 'mg' }),
      ]),
      0
    );

    expect(detail?.macros.map((m) => m.metric)).toEqual([
      'calories',
      'protein',
    ]);
    expect(detail?.nutrients.map((m) => m.metric)).toEqual(['calciumMg']);
    expect(detail?.startDate).toBe('2026-05-01');
  });

  it('converts ratioOfTarget into a percentage', () => {
    const detail = buildBucketDetail(
      daySeries([series('calciumMg', [500], { target: 1000, unit: 'mg' })]),
      0
    );
    expect(detail?.nutrients[0].percentOfTarget).toBeCloseTo(50);
  });

  it('leaves percentOfTarget null when the nutrient has no target', () => {
    const detail = buildBucketDetail(
      daySeries([series('calciumMg', [500], { unit: 'mg' })]),
      0
    );
    expect(detail?.nutrients[0].percentOfTarget).toBeNull();
    expect(detail?.nutrients[0].value).toBe(500);
  });

  it('drops metrics whose bucket is a gap rather than reporting zero', () => {
    const detail = buildBucketDetail(
      daySeries([
        series('calories', [2000, null], { target: 2000, unit: 'kcal' }),
        series('calciumMg', [500, null], { target: 1000, unit: 'mg' }),
      ]),
      1
    );
    expect(detail).toBeNull();
  });

  it('orders macros consistently regardless of series order', () => {
    const detail = buildBucketDetail(
      daySeries([
        series('fat', [50], { target: 70 }),
        series('calories', [2000], { target: 2000, unit: 'kcal' }),
        series('carbohydrate', [200], { target: 200 }),
      ]),
      0
    );
    expect(detail?.macros.map((m) => m.metric)).toEqual([
      'calories',
      'carbohydrate',
      'fat',
    ]);
  });

  it('returns null for an out-of-range index', () => {
    expect(
      buildBucketDetail(daySeries([series('calories', [2000])]), 9)
    ).toBeNull();
  });
});

describe('formatBucketRange', () => {
  it('names the weekday for a single-day bucket', () => {
    // 2026-05-04 is a Monday.
    expect(
      formatBucketRange(
        { startDate: '2026-05-04', endDate: '2026-05-04' },
        'en'
      )
    ).toBe('Monday, May 4');
  });

  it('renders a span for a week bucket', () => {
    expect(
      formatBucketRange(
        { startDate: '2026-05-04', endDate: '2026-05-10' },
        'en'
      )
    ).toBe('May 4 – May 10');
  });
});
