import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { userProfiles } from '@/lib/db/schema';
import type { OverviewMealItemRow } from './overview-query';

const {
  mockCountLoggedDaysLast30,
  mockFetchOverviewRows,
  mockRequireAuthAndProfile,
} = vi.hoisted(() => ({
  mockCountLoggedDaysLast30: vi.fn(),
  mockFetchOverviewRows: vi.fn(),
  mockRequireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

vi.mock('./overview-query', () => ({
  countLoggedDaysLast30: mockCountLoggedDaysLast30,
  fetchOverviewRows: mockFetchOverviewRows,
}));

import { requireAuthAndProfile } from '@/lib/auth';
import { getNutritionOverview } from './overview';
import { fetchOverviewRows } from './overview-query';

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
    calories: 1999,
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
    calories: 2001,
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

    expect(macros.calories.consistencyPct).toBe(33);
    expect(macros.protein.consistencyPct).toBe(67);
    expect(macros.carbohydrate.consistencyPct).toBe(67);
    expect(macros.fat.consistencyPct).toBe(67);
    expect(overview.summary.macroConsistency).toEqual({
      averageConsistencyPct: 59,
      weakestMacro: 'calories',
    });
  });
});
