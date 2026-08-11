import { describe, expect, it } from 'vitest';
import type {
  DaySeriesBucket,
  NutrientDaySeries,
  NutritionDaySeries,
} from '@/lib/nutrition/types';
import {
  buildBucketTickLabels,
  buildMacroTrendAxis,
  buildMacroTrendData,
  findTodayIndex,
  formatBucketLabel,
  isColumnDimmed,
  localIsoDate,
  type MacroTrendPoint,
} from './macro-trend-utils';

function bucket(startDate: string, value: number | null): DaySeriesBucket {
  return {
    startDate,
    endDate: startDate,
    value,
    ratioOfTarget: null,
    excluded: false,
  };
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
  it('tops out just above the data instead of a fixed 3000 ceiling', () => {
    const axis = buildMacroTrendAxis(1400);
    expect(axis.step).toBe(250);
    expect(axis.maxLabel).toBe(1500);
    expect(axis.ticks).toEqual([250, 500, 750, 1000, 1250, 1500]);
  });

  it('keeps a 500 step for a 3000 axis (maxY 2600)', () => {
    const axis = buildMacroTrendAxis(2600);
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

  it('floors the step at 100 so a near-empty chart is not labelled in tens', () => {
    const axis = buildMacroTrendAxis(40);
    expect(axis.step).toBe(100);
    expect(axis.maxLabel).toBe(100);
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

  it('keeps a bucket null on every macro so it renders as a gap', () => {
    // The middle day was set aside as partial: the server returns null on every
    // metric. It must NOT become a zero-height column, which would read as
    // "ate nothing" rather than "no data".
    const data = buildMacroTrendData(
      daySeries('day', [
        series('protein', [100, null, 80]),
        series('carbohydrate', [200, null, 150]),
        series('fat', [10, null, 20]),
      ])
    );
    expect(data?.points[1]).toMatchObject({
      protein: null,
      carbohydrate: null,
      fat: null,
    });
    // …and the gap must not drag the axis down either.
    expect(data?.maxY).toBe(1290);
  });
  it('carries the scope-excluded flag through to the point', () => {
    // The flag is what greys a column; a regression that dropped it would
    // otherwise pass, since every fixture bucket sets it false.
    const withExcluded = daySeries('day', [
      series('protein', [100, 90]),
      series('carbohydrate', [200, 180]),
      series('fat', [10, 12]),
    ]);
    for (const s of withExcluded.series) {
      s.buckets[1] = { ...s.buckets[1], excluded: true };
    }

    const data = buildMacroTrendData(withExcluded);

    expect(data?.points[0].excluded).toBe(false);
    // Excluded, but still carrying its real height.
    expect(data?.points[1]).toMatchObject({ excluded: true, protein: 360 });
  });
});

describe('isColumnDimmed', () => {
  const col = (index: number, excluded: boolean) => ({ index, excluded });

  it('greys the scope-excluded columns when nothing is selected', () => {
    expect(isColumnDimmed(col(0, false), null)).toBe(false);
    expect(isColumnDimmed(col(1, true), null)).toBe(true);
  });

  it('greys everything but the selection once one exists', () => {
    expect(isColumnDimmed(col(1, false), 1)).toBe(false);
    expect(isColumnDimmed(col(0, false), 1)).toBe(true);
  });

  it('colours a selected column even when the scope excludes it', () => {
    // The regression: `excluded || not-selected` greyed the WHOLE chart when
    // the tapped column was itself excluded, leaving no colour anywhere.
    expect(isColumnDimmed(col(1, true), 1)).toBe(false);
    expect(isColumnDimmed(col(0, true), 1)).toBe(true);
    expect(isColumnDimmed(col(2, false), 1)).toBe(true);
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

  it('uses the Vietnamese numeric weekday scheme (Mon=2..Sat=7)', () => {
    // 2026-05-04 is a Monday → "2".
    expect(formatBucketLabel('2026-05-04', 'day', 'vi')).toBe('2');
  });

  it('labels Sunday as "CN" in Vietnamese', () => {
    // 2026-05-03 is a Sunday → "CN".
    expect(formatBucketLabel('2026-05-03', 'day', 'vi')).toBe('CN');
  });

  it('leaves non-vi locales on the first-grapheme behavior', () => {
    // 2026-05-04 is a Monday → English initial "M".
    expect(formatBucketLabel('2026-05-04', 'day', 'en')).toBe('M');
  });
});

describe('findTodayIndex', () => {
  const point = (startDate: string, endDate: string) => ({
    startDate,
    endDate,
  });

  it('matches the exact day on a day axis', () => {
    const points = [
      point('2026-05-04', '2026-05-04'),
      point('2026-05-05', '2026-05-05'),
      point('2026-05-06', '2026-05-06'),
    ];
    expect(findTodayIndex(points, '2026-05-05')).toBe(1);
  });

  it('matches the containing week on a week axis', () => {
    const points = [
      point('2026-04-27', '2026-05-03'),
      point('2026-05-04', '2026-05-10'),
    ];
    expect(findTodayIndex(points, '2026-05-07')).toBe(1);
  });

  it('returns -1 when today is outside the window', () => {
    expect(
      findTodayIndex([point('2026-05-04', '2026-05-04')], '2026-06-01')
    ).toBe(-1);
  });
});

describe('localIsoDate', () => {
  it('reads the LOCAL calendar date, not the UTC one', () => {
    // 22:30 on the 4th in a UTC+3 zone is still the 4th locally, while
    // toISOString() would have to be the 4th or 5th depending on the host.
    const local = new Date(2026, 4, 4, 22, 30);
    expect(localIsoDate(local)).toBe('2026-05-04');
  });

  it('zero-pads month and day', () => {
    expect(localIsoDate(new Date(2026, 0, 9, 12))).toBe('2026-01-09');
  });
});

describe('buildBucketTickLabels', () => {
  /** `count` consecutive buckets stepping `stepDays` from `start`. */
  function points(
    start: string,
    count: number,
    stepDays: number
  ): MacroTrendPoint[] {
    const startMs = Date.parse(`${start}T00:00:00.000Z`);
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return Array.from({ length: count }, (_, i) => {
      const bucketStart = startMs + i * stepDays * 86_400_000;
      return {
        index: i,
        startDate: iso(bucketStart),
        endDate: iso(bucketStart + (stepDays - 1) * 86_400_000),
        protein: 0,
        carbohydrate: 0,
        fat: 0,
        excluded: false,
      };
    });
  }

  it('labels every column on the 7-day axis', () => {
    // 2026-05-04 is a Monday.
    const labels = buildBucketTickLabels(
      points('2026-05-04', 7, 1),
      'day',
      'en'
    );
    expect(labels).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('labels every column on the 30-day (5 week) axis', () => {
    const labels = buildBucketTickLabels(
      points('2026-05-04', 5, 7),
      'week',
      'en'
    );
    expect(labels).toEqual(['4/5', '11/5', '18/5', '25/5', '1/6']);
  });

  it('anchors the 90-day axis at month boundaries', () => {
    // 13 weekly buckets from 2026-02-02 span February through April.
    const labels = buildBucketTickLabels(
      points('2026-02-02', 13, 7),
      'week',
      'en'
    );
    expect(labels.filter(Boolean)).toEqual(['Feb', 'Mar', 'Apr']);
    expect(labels[0]).toBe('Feb');
    expect(labels).toHaveLength(13);
  });

  it('uses a compact Th<n> month anchor in Vietnamese', () => {
    // CLDR's vi abbreviation ("Tháng 2") is wide enough that the last anchor
    // runs off the card and the neighbours nearly touch, so this axis uses the
    // same compact scheme as its weekday labels.
    const labels = buildBucketTickLabels(
      points('2026-02-02', 13, 7),
      'week',
      'vi'
    );
    expect(labels.filter(Boolean)).toEqual(['Th2', 'Th3', 'Th4']);
  });
});
