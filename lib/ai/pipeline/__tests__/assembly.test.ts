import { describe, expect, it } from 'vitest';
import type {
  MealDecomposition,
  NutritionAdjustment,
  UserContext,
} from '../../types';
import { assembleResult } from '../assembly';

const userContext: UserContext = {
  goal: 'cutting',
  aggression: 0.5,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

describe('assembleResult — id-keyed lookups', () => {
  it('does not collapse two ingredients sharing a display name across dishes', () => {
    // Two dishes both containing "nước dùng" but with different ids and grams.
    // Pre-fix (name-keyed) assembly silently picks one llm-nutrition record
    // for both. Post-fix (id-keyed) each instance gets its own llm-nutrition.
    const decomposition: MealDecomposition = {
      isFood: true,
      mealSlot: 'dinner',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          name: 'bún bò Huế',
          ingredients: [
            {
              ingredientId: 'ing-2',
              name: 'nước dùng',
              estimatedGrams: 250,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    const nutrition: NutritionAdjustment = {
      mealItems: [
        {
          mealItemId: 'meal-A',
          mealItemName: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              ingredientName: 'nước dùng',
              caloriesKcal: { low: 50, mid: 60, high: 70 },
              proteinG: { low: 1, mid: 2, high: 3 },
              carbohydrateG: { low: 1, mid: 2, high: 3 },
              fatG: { low: 0.5, mid: 1, high: 1.5 },
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          mealItemName: 'bún bò Huế',
          ingredients: [
            {
              ingredientId: 'ing-2',
              ingredientName: 'nước dùng',
              caloriesKcal: { low: 90, mid: 100, high: 110 },
              proteinG: { low: 3, mid: 4, high: 5 },
              carbohydrateG: { low: 4, mid: 5, high: 6 },
              fatG: { low: 1.5, mid: 2, high: 2.5 },
            },
          ],
        },
      ],
    };

    const result = assembleResult(
      decomposition,
      nutrition,
      [],
      [],
      userContext
    );

    expect(result.mealItems[0].boundedNutrition.caloriesKcal?.mid).toBe(60);
    expect(result.mealItems[1].boundedNutrition.caloriesKcal?.mid).toBe(100);
  });
});
