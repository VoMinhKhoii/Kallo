import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { userProfiles } from '@/lib/db/schema';
import type { OverviewMealItemRow } from '@/lib/nutrition/actions/overview/query';

const {
  mockCountLoggedDaysLast30,
  mockFetchDailyCalorieTotals,
  mockFetchOverviewRows,
  mockRequireAuthAndProfile,
} = vi.hoisted(() => ({
  mockCountLoggedDaysLast30: vi.fn(),
  mockFetchDailyCalorieTotals: vi.fn(),
  mockFetchOverviewRows: vi.fn(),
  mockRequireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

vi.mock('@/lib/nutrition/actions/overview/query', () => ({
  countLoggedDaysLast30: mockCountLoggedDaysLast30,
  fetchDailyCalorieTotals: mockFetchDailyCalorieTotals,
  fetchOverviewRows: mockFetchOverviewRows,
}));

import { requireAuthAndProfile } from '@/lib/auth';
import { getNutritionOverview } from '@/lib/nutrition/actions/overview';
import { fetchOverviewRows } from '@/lib/nutrition/actions/overview/query';

const baseProfile = {
  userId: 'user-1',
  biologicalSex: 'male',
  age: 35,
  countryOfOrigin: 'VN',
  countryOfResidence: 'VN',
  calorieTarget: 2000,
  proteinTargetG: 100,
  carbsTargetG: 200,
  fatTargetG: 70,
  goal: 'maintaining',
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

const threeDayRows = [
  row({
    localDate: '2026-04-23',
    calories: 2000,
    proteinG: 90,
    carbohydrateG: 170,
    fatG: 59.5,
    sourceCode: 'FAO_VN_2007',
    typeEn: 'Condiments, traditional sauces',
    typeVn: 'Gia vị, nước chấm',
    sodiumMg: null,
  }),
  row({
    localDate: '2026-04-24',
    calories: 2000,
    proteinG: 89,
    carbohydrateG: 230,
    fatG: 80.5,
  }),
  row({
    localDate: '2026-04-25',
    calories: 2000,
    proteinG: 100,
    carbohydrateG: 169,
    fatG: 81,
  }),
];

describe('getNutritionOverview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T12:00:00.000Z'));
    vi.clearAllMocks();
    mockRequireAuthAndProfile.mockResolvedValue({
      user: { id: 'user-1' },
      profile: baseProfile,
    });
    mockCountLoggedDaysLast30.mockResolvedValue(14);
    mockFetchOverviewRows.mockResolvedValue(threeDayRows);
    mockFetchDailyCalorieTotals.mockResolvedValue([]);
  });

  it('rejects invalid ranges', async () => {
    await expect(
      getNutritionOverview({ range: '365d', timezoneOffset: null })
    ).rejects.toThrow();
  });

  it('passes authenticated user id into fetchOverviewRows', async () => {
    await getNutritionOverview({ range: '7d', timezoneOffset: null });

    expect(requireAuthAndProfile).toHaveBeenCalledTimes(1);
    expect(fetchOverviewRows).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    );
  });

  it('reads the previous window as a per-day calorie aggregate, not full item rows', async () => {
    mockFetchDailyCalorieTotals.mockResolvedValue([
      { date: '2026-04-13', calories: 2000 },
      { date: '2026-04-14', calories: 1000 },
      // Under half the 2000 kcal target — partial, so it counts toward `all`
      // but not `complete`.
      { date: '2026-04-15', calories: 400 },
    ]);

    const overview = await getNutritionOverview({
      range: '7d',
      timezoneOffset: null,
    });

    // The 7d window is Mon 20th–Sun 26th, so the previous one is the 13th–19th.
    expect(mockFetchDailyCalorieTotals).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        startDate: '2026-04-13',
        endDate: '2026-04-19',
      })
    );
    // One query for the current window only — the previous one never pulls rows.
    expect(mockFetchOverviewRows).toHaveBeenCalledTimes(1);
    expect(overview.previousCalorieAverages).toEqual({
      all: { averagePerDay: 1133.3333333333333, days: 3 },
      complete: { averagePerDay: 1500, days: 2 },
    });
  });

  it('returns ready 7d overview and sodium caveat from FAO condiment missing sodium', async () => {
    const overview = await getNutritionOverview({
      range: '7d',
      timezoneOffset: null,
    });
    const sodium = overview.moreNutrients.find(
      (card) => card.nutrient === 'sodiumMg'
    );

    expect(overview.loggedDays).toBe(3);
    expect(overview.trendStatus).toBe('ready');
    expect(sodium?.caveatKey).toBe('nutrition.caveats.sodium');
  });

  it('returns too_few_logged_days for selected 30d with nine logged days', async () => {
    mockCountLoggedDaysLast30.mockResolvedValue(9);
    mockFetchOverviewRows.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) =>
        row({ localDate: `2026-04-${String(index + 1).padStart(2, '0')}` })
      )
    );

    const overview = await getNutritionOverview({
      range: '30d',
      timezoneOffset: null,
    });

    expect(overview.loggedDays).toBe(9);
    expect(overview.trendStatus).toBe('too_few_logged_days');
  });

  it('does not include trend arrays in overview cards', async () => {
    const overview = await getNutritionOverview({
      range: '7d',
      timezoneOffset: null,
    });

    for (const card of [
      ...overview.micronutrients,
      ...overview.moreNutrients,
    ]) {
      expect('trend' in card).toBe(false);
    }
  });

  it('uses profile targets for macro consistency thresholds', async () => {
    const overview = await getNutritionOverview({
      range: '7d',
      timezoneOffset: null,
    });
    const macros = Object.fromEntries(
      overview.macros.map((macro) => [macro.key, macro])
    );

    expect(macros.calories.consistencyPct).toBe(100);
    expect(macros.protein.consistencyPct).toBe(67);
    expect(macros.carbohydrate.consistencyPct).toBe(67);
    expect(macros.fat.consistencyPct).toBe(67);
    expect(overview.summary.macroConsistency).toEqual({
      averageConsistencyPct: 75,
      weakestMacro: 'protein',
    });
  });
});
