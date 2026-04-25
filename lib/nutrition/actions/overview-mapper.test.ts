import { describe, expect, it } from 'vitest';
import type { userProfiles } from '@/lib/db/schema';
import { mapOverviewRowsToDto } from './overview-mapper';
import type { OverviewMealItemRow } from './overview-query';

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

  it('does not include trend arrays in overview nutrient cards', () => {
    const overview = mapRows([row({})]);

    for (const card of [
      ...overview.micronutrients,
      ...overview.moreNutrients,
    ]) {
      expect('trend' in card).toBe(false);
    }
  });
});
