import { describe, expect, it } from 'vitest';
import type { userProfiles } from '@/lib/db/schema';
import { mapOverviewRowsToDto } from '@/lib/nutrition/actions/overview/mapper';
import type { OverviewMealItemRow } from '@/lib/nutrition/actions/overview/query';

const baseProfile = {
  biologicalSex: 'male',
  age: 35,
  countryOfOrigin: 'VN',
  countryOfResidence: 'VN',
  calorieTarget: 2000,
  proteinTargetG: 100,
  carbsTargetG: 200,
  fatTargetG: 70,
} as typeof userProfiles.$inferSelect;

function row(overrides: Partial<OverviewMealItemRow>): OverviewMealItemRow {
  return {
    localDate: '2026-04-25',
    calories: 100,
    proteinG: 10,
    carbohydrateG: 20,
    fatG: 5,
    fiberG: 2,
    sourceCode: null,
    typeEn: null,
    typeVn: null,
    calciumMg: 50,
    ironMg: 1,
    vitaminCMg: 5,
    phosphorusMg: 40,
    vitaminB1Mg: 0.1,
    vitaminB2Mg: 0.1,
    vitaminPpMg: 1,
    vitaminAMcg: 20,
    betaCaroteneMcg: 100,
    sodiumMg: 50,
    magnesiumMg: 10,
    potassiumMg: 100,
    zincMg: 1,
    copperMcg: 20,
    manganeseMg: 0.1,
    vitaminB12Mcg: 0.1,
    vitaminB9Mcg: 10,
    vitaminB5Mg: 0.1,
    vitaminB6Mg: 0.1,
    vitaminEMg: 0.5,
    vitaminKMcg: 1,
    ...overrides,
  };
}

function mapRows(rows: OverviewMealItemRow[]) {
  return mapOverviewRowsToDto({
    rows,
    profile: baseProfile,
    requestedRange: '7d',
    resolvedRange: '7d',
    loggedDaysLast30: rows.length,
    period: {
      startDate: '2026-04-19',
      endDate: '2026-04-25',
      bucketTimezone: 'local',
    },
  });
}

describe('mapOverviewRowsToDto', () => {
  it('lowers confidence when calories have null nutrient data', () => {
    const overview = mapRows([
      row({ localDate: '2026-04-24', calories: 100, calciumMg: 100 }),
      row({ localDate: '2026-04-25', calories: 300, calciumMg: null }),
    ]);
    const calcium = overview.micronutrients.find(
      (card) => card.nutrient === 'calciumMg'
    );

    expect(calcium?.averagePerDay).toBe(50);
    expect(calcium?.confidence).toBe(25);
  });

  it('adds sodium source breakdown and caveat for FAO condiment rows missing sodium', () => {
    const overview = mapRows([
      row({
        calories: 300,
        sourceCode: 'FAO_VN_2007',
        typeEn: 'Condiments, traditional sauces',
        typeVn: 'Gia vị, nước chấm',
        sodiumMg: null,
      }),
      row({ calories: 100, sourceCode: 'USDA', sodiumMg: 100 }),
    ]);
    const sodium = overview.moreNutrients.find(
      (card) => card.nutrient === 'sodiumMg'
    );

    expect(sodium?.caveatKey).toBe('nutrition.caveats.sodium');
    expect(sodium?.sourceBreakdown).toEqual({
      faoVietnamCalorieShare: 0.75,
      faoVietnamConfidence: 0,
      missingSodiumCondimentItems: 1,
    });
  });

  it('excludes partial (under-logged) days from averages and consistency', () => {
    const overview = mapRows([
      row({ localDate: '2026-04-22', calories: 2000, proteinG: 100 }),
      row({ localDate: '2026-04-23', calories: 2000, proteinG: 100 }),
      row({ localDate: '2026-04-24', calories: 2000, proteinG: 100 }),
      // Breakfast-only day: < 50% of the 2000 kcal target.
      row({ localDate: '2026-04-25', calories: 400, proteinG: 10 }),
    ]);

    expect(overview.completeDays).toBe(3);
    expect(overview.partialDays).toBe(1);

    const calories = overview.macros.find((m) => m.key === 'calories');
    // Averaged over the 3 complete days only — not dragged down to 1600 by
    // the partial day ((2000*3 + 400) / 4).
    expect(calories?.averagePerDay).toBe(2000);
    // The partial day is not counted as a calorie/protein consistency miss.
    expect(calories?.consistencyPct).toBe(100);
    const protein = overview.macros.find((m) => m.key === 'protein');
    expect(protein?.consistencyPct).toBe(100);
  });

  it('does not include trend arrays in overview nutrient cards', () => {
    const overview = mapRows([row({})]);

    for (const card of [
      ...overview.micronutrients,
      ...overview.moreNutrients,
    ]) {
      expect('trend' in card).toBe(false);
    }
  });

  describe('daySeries', () => {
    it('emits one day bucket per calendar day for the 7d range', () => {
      const overview = mapRows([
        row({ localDate: '2026-04-24', calories: 2000, proteinG: 100 }),
        row({ localDate: '2026-04-25', calories: 2000, proteinG: 100 }),
      ]);

      expect(overview.daySeries.unit).toBe('day');
      // The 7d period spans 2026-04-19..2026-04-25 → 7 day buckets.
      const calories = overview.daySeries.series.find(
        (s) => s.metric === 'calories'
      );
      expect(calories?.buckets).toHaveLength(7);
      // Days with no complete log read null (gap), not zero.
      expect(
        calories?.buckets.find((b) => b.startDate === '2026-04-19')?.value
      ).toBeNull();
      // Logged complete days carry their per-day total.
      expect(
        calories?.buckets.find((b) => b.startDate === '2026-04-25')?.value
      ).toBe(2000);
    });

    it('reports per-metric min/max across non-null buckets for the whisker band', () => {
      const overview = mapRows([
        row({ localDate: '2026-04-23', calories: 1800, proteinG: 90 }),
        row({ localDate: '2026-04-24', calories: 2200, proteinG: 110 }),
        row({ localDate: '2026-04-25', calories: 2000, proteinG: 100 }),
      ]);

      const calories = overview.daySeries.series.find(
        (s) => s.metric === 'calories'
      );
      expect(calories?.min).toBe(1800);
      expect(calories?.max).toBe(2200);
      // ratioOfTarget is the per-day value over the calorie target (2000).
      const peak = calories?.buckets.find((b) => b.startDate === '2026-04-24');
      expect(peak?.ratioOfTarget).toBeCloseTo(1.1);
    });

    it('buckets by week for the 30d range', () => {
      const rows: OverviewMealItemRow[] = [];
      // 28 fully-logged days ending 2026-04-25.
      for (let i = 0; i < 28; i++) {
        const date = new Date(
          Date.parse('2026-04-25T00:00:00.000Z') - i * 86_400_000
        )
          .toISOString()
          .slice(0, 10);
        rows.push(row({ localDate: date, calories: 2000, proteinG: 100 }));
      }
      const overview = mapOverviewRowsToDto({
        rows,
        profile: baseProfile,
        requestedRange: '30d',
        resolvedRange: '30d',
        loggedDaysLast30: 28,
        period: {
          startDate: '2026-03-27',
          endDate: '2026-04-25',
          bucketTimezone: 'local',
        },
      });

      expect(overview.daySeries.unit).toBe('week');
      const calories = overview.daySeries.series.find(
        (s) => s.metric === 'calories'
      );
      // 30 days / 7 → 5 week buckets (the final one clamps to the period end).
      expect(calories?.buckets).toHaveLength(5);
    });

    it('buckets by week for the 90d range', () => {
      const rows: OverviewMealItemRow[] = [];
      // 90 fully-logged days ending 2026-04-25.
      for (let i = 0; i < 90; i++) {
        const date = new Date(
          Date.parse('2026-04-25T00:00:00.000Z') - i * 86_400_000
        )
          .toISOString()
          .slice(0, 10);
        rows.push(row({ localDate: date, calories: 2000, proteinG: 100 }));
      }
      const overview = mapOverviewRowsToDto({
        rows,
        profile: baseProfile,
        requestedRange: '90d',
        resolvedRange: '90d',
        loggedDaysLast30: 30,
        period: {
          startDate: '2026-01-26',
          endDate: '2026-04-25',
          bucketTimezone: 'local',
        },
      });

      expect(overview.daySeries.unit).toBe('week');
      const calories = overview.daySeries.series.find(
        (s) => s.metric === 'calories'
      );
      // 90 days / 7 → 13 week buckets (the final one clamps to the period end).
      expect(calories?.buckets).toHaveLength(13);
    });

    it('includes the default micronutrients in the series', () => {
      const overview = mapRows([
        row({ localDate: '2026-04-25', calciumMg: 600 }),
      ]);
      const metrics = overview.daySeries.series.map((s) => s.metric);
      expect(metrics).toContain('calciumMg');
      expect(metrics).toContain('protein');
    });

    it('returns an empty series for a zero-logged period', () => {
      const overview = mapRows([row({ calories: 0 })]);
      expect(overview.daySeries.series).toHaveLength(0);
    });
  });

  describe('day scope', () => {
    function mapScoped(
      rows: OverviewMealItemRow[],
      dayScope: 'all' | 'complete' | undefined
    ) {
      return mapOverviewRowsToDto({
        rows,
        profile: baseProfile,
        requestedRange: '7d',
        resolvedRange: '7d',
        loggedDaysLast30: rows.length,
        period: {
          startDate: '2026-04-19',
          endDate: '2026-04-25',
          bucketTimezone: 'local',
        },
        dayScope,
      });
    }

    // calorieTarget 2000 → partial-day floor is 1000 kcal.
    const completeDay = row({ localDate: '2026-04-24', calories: 2000 });
    const partialDay = row({ localDate: '2026-04-25', calories: 400 });
    const caloriesAvg = (o: ReturnType<typeof mapScoped>) =>
      o.macros.find((m) => m.key === 'calories')?.averagePerDay ?? null;

    it('ships both calorie averages regardless of scope', () => {
      const overview = mapScoped([completeDay, partialDay], undefined);
      // all = (2000 + 400) / 2 logged days; complete = 2000 / 1 strict day.
      expect(overview.calorieAverages.all).toEqual({
        averagePerDay: 1200,
        days: 2,
      });
      expect(overview.calorieAverages.complete).toEqual({
        averagePerDay: 2000,
        days: 1,
      });
    });

    it("days:'all' averages the body over every logged day", () => {
      const overview = mapScoped([completeDay, partialDay], 'all');
      expect(caloriesAvg(overview)).toBe(1200);
      // Counts still report the strict classification.
      expect(overview.completeDays).toBe(1);
      expect(overview.partialDays).toBe(1);
    });

    it("days:'complete' averages the body over strict complete days only", () => {
      const overview = mapScoped([completeDay, partialDay], 'complete');
      expect(caloriesAvg(overview)).toBe(2000);
      expect(overview.completeDays).toBe(1);
    });

    it("days:'complete' with only under-logged days returns a zeroed body", () => {
      const overview = mapScoped(
        [
          row({ localDate: '2026-04-24', calories: 400 }),
          row({ localDate: '2026-04-25', calories: 300 }),
        ],
        'complete'
      );
      expect(overview.completeDays).toBe(0);
      // The body keeps its shape at zero rather than collapsing: every nutrient
      // row is present with its real target and a null average, so the client
      // renders the same page with "—" instead of a separate empty screen.
      expect(overview.macros.length).toBeGreaterThan(0);
      expect(overview.macros.every((m) => m.averagePerDay === 0)).toBe(true);
      expect(overview.micronutrients.length).toBeGreaterThan(0);
      expect(
        overview.micronutrients.every(
          (c) => c.averagePerDay === null && c.percentOfTarget === null
        )
      ).toBe(true);
      expect(overview.micronutrients.every((c) => c.target !== null)).toBe(
        true
      );
      // The chart still has nothing to draw.
      expect(overview.daySeries.series).toHaveLength(0);
      expect(overview.calorieAverages.complete.averagePerDay).toBeNull();
      expect(overview.calorieAverages.all.averagePerDay).toBe(350);
    });

    it('holds the chart steady across scopes, averaging over logged days', () => {
      // The invariant the day-scope toggle promises: it changes the averages
      // above the chart, never the bars. The series is built over every logged
      // day in both scopes, so a bucket cannot re-average on a toggle — which
      // is what made weeks holding a partial day jump.
      const rows = [completeDay, partialDay];
      const bucketsFor = (scope: 'all' | 'complete') =>
        mapScoped(rows, scope).daySeries.series.find(
          (s) => s.metric === 'calories'
        )?.buckets ?? [];

      expect(bucketsFor('complete')).toEqual(bucketsFor('all'));

      // Both days are logged, so both carry their own total — the partial day
      // included, and neither dragged toward the other.
      const buckets = bucketsFor('complete');
      expect(buckets.find((b) => b.startDate === '2026-04-24')?.value).toBe(
        2000
      );
      expect(buckets.find((b) => b.startDate === '2026-04-25')?.value).toBe(
        400
      );
      // A day with nothing logged is still a gap, not a zero.
      expect(
        buckets.find((b) => b.startDate === '2026-04-19')?.value
      ).toBeNull();

      // …while the headline averages still respond to the scope.
      expect(caloriesAvg(mapScoped(rows, 'complete'))).toBe(2000);
      expect(caloriesAvg(mapScoped(rows, 'all'))).toBe(1200);
    });

    it('legacy (no scope) keeps the safety valve for all-partial periods', () => {
      const overview = mapScoped(
        [
          row({ localDate: '2026-04-24', calories: 400 }),
          row({ localDate: '2026-04-25', calories: 300 }),
        ],
        undefined
      );
      // Valve treats both under-logged days as complete → body still populated.
      expect(caloriesAvg(overview)).toBe(350);
      expect(overview.completeDays).toBe(2);
    });
  });
});
