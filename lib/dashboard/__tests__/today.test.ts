import { describe, expect, it } from 'vitest';
import type { PersistedMeal } from '@/lib/actions/meals';
import {
  buildTodayNutritionData,
  getTodayDateString,
  mapPersistedMealsToMealEntries,
} from '@/lib/dashboard/today';

const targets = {
  calorieTarget: 1800,
  proteinTargetG: 140,
  carbsTargetG: 180,
  fatTargetG: 60,
};

const meals: PersistedMeal[] = [
  {
    id: 'meal-1',
    rawInput: 'Pho bo',
    mealSlot: 'breakfast',
    confidenceOverall: 'high',
    loggedAt: '2026-04-29T01:00:00.000Z',
    nutrition: {
      caloriesKcal: 553.4,
      proteinG: 37.6,
      carbohydrateG: 61.5,
      fatG: 17.8,
      fiberG: null,
      sodiumMg: null,
      calciumMg: null,
      ironMg: null,
      magnesiumMg: null,
      phosphorusMg: null,
      potassiumMg: null,
      zincMg: null,
      copperMcg: null,
      manganeseMg: null,
      betaCaroteneMcg: null,
      vitaminAMcg: null,
      vitaminDMcg: null,
      vitaminEMg: null,
      vitaminKMcg: null,
      vitaminCMg: null,
      vitaminB1Mg: null,
      vitaminB2Mg: null,
      vitaminPpMg: null,
      vitaminB5Mg: null,
      vitaminB6Mg: null,
      vitaminB9Mcg: null,
      vitaminB12Mcg: null,
      vitaminHMcg: null,
    },
    mealItemGroups: [],
  },
  {
    id: 'meal-2',
    rawInput: 'Sua chua',
    mealSlot: 'snack',
    confidenceOverall: 'medium',
    loggedAt: '2026-04-29T08:00:00.000Z',
    nutrition: {
      caloriesKcal: null,
      proteinG: 2.4,
      carbohydrateG: 14.4,
      fatG: null,
      fiberG: null,
      sodiumMg: null,
      calciumMg: null,
      ironMg: null,
      magnesiumMg: null,
      phosphorusMg: null,
      potassiumMg: null,
      zincMg: null,
      copperMcg: null,
      manganeseMg: null,
      betaCaroteneMcg: null,
      vitaminAMcg: null,
      vitaminDMcg: null,
      vitaminEMg: null,
      vitaminKMcg: null,
      vitaminCMg: null,
      vitaminB1Mg: null,
      vitaminB2Mg: null,
      vitaminPpMg: null,
      vitaminB5Mg: null,
      vitaminB6Mg: null,
      vitaminB9Mcg: null,
      vitaminB12Mcg: null,
      vitaminHMcg: null,
    },
    mealItemGroups: [],
  },
];

describe('dashboard today helpers', () => {
  it('maps persisted meals into dashboard meal entries', () => {
    expect(mapPersistedMealsToMealEntries(meals)).toEqual([
      { id: 'meal-1', label: 'Pho bo', calories: 553 },
      { id: 'meal-2', label: 'Sua chua', calories: 0 },
    ]);
  });

  it('builds today nutrition totals from persisted meals and targets', () => {
    expect(buildTodayNutritionData(meals, targets)).toEqual({
      calories: { current: 553, target: 1800 },
      protein: { current: 40, target: 140 },
      carbs: { current: 76, target: 180 },
      fat: { current: 18, target: 60 },
    });
  });

  it('formats the current local date as yyyy-mm-dd', () => {
    expect(getTodayDateString(new Date('2026-04-29T12:34:56.000Z'))).toBe(
      '2026-04-29'
    );
  });
});
