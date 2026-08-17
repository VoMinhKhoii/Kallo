import { describe, expect, it } from 'vitest';
import {
  buildBucketDetail,
  formatDateSpan,
} from '@/lib/domain/nutrition/bucket-detail';
import type {
  DaySeriesBucket,
  NutrientDaySeries,
  NutritionDaySeries,
} from '@/lib/domain/nutrition/types';

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
      excluded: false,
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

  it('returns null when EVERY metric is a gap at that bucket', () => {
    const detail = buildBucketDetail(
      daySeries([
        series('calories', [2000, null], { target: 2000, unit: 'kcal' }),
        series('calciumMg', [500, null], { target: 1000, unit: 'mg' }),
      ]),
      1
    );
    expect(detail).toBeNull();
  });

  it('drops only the gap metric when others still report', () => {
    const detail = buildBucketDetail(
      daySeries([
        series('calories', [2000, 1800], { target: 2000, unit: 'kcal' }),
        series('calciumMg', [500, null], { target: 1000, unit: 'mg' }),
      ]),
      1
    );
    expect(detail).not.toBeNull();
    expect(detail?.macros.map((m) => m.metric)).toEqual(['calories']);
    expect(detail?.nutrients).toEqual([]);
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

describe('formatDateSpan', () => {
  it('collapses a single day to one dated day', () => {
    expect(formatDateSpan('2026-05-04', '2026-05-04', 'en')).toBe('4 May 2026');
  });

  it('states the month and year once inside a single month', () => {
    expect(formatDateSpan('2026-08-10', '2026-08-16', 'en')).toBe(
      '10 – 16 Aug 2026'
    );
  });

  it('repeats the month when the span crosses one', () => {
    expect(formatDateSpan('2026-07-28', '2026-08-03', 'en')).toBe(
      '28 Jul – 3 Aug 2026'
    );
  });

  it('states both years when the span crosses one', () => {
    expect(formatDateSpan('2025-12-29', '2026-01-04', 'en')).toBe(
      '29 Dec 2025 – 4 Jan 2026'
    );
  });

  it('takes the month token from the locale', () => {
    // vi spells the short month "thg 8", and day-first suits it natively.
    expect(formatDateSpan('2026-08-10', '2026-08-16', 'vi')).toBe(
      `10 – 16 ${new Intl.DateTimeFormat('vi', { month: 'short' }).format(
        new Date('2026-08-16T00:00:00')
      )} 2026`
    );
  });
});
