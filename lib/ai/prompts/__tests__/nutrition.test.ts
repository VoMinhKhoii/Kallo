import { describe, expect, it } from 'vitest';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '../../types';
import { buildNutritionPrompt } from '../nutrition';

const USER_CONTEXT: UserContext = {
  goal: 'cutting',
  aggression: 0.5,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    sugarBraised: 'high',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const MATCHED_INGREDIENT: MatchedIngredient = {
  ingredientName: 'gạo',
  foodCompositionId: 'fc-gao-002',
  matchedName: 'Gạo tẻ',
  similarity: 0.95,
  confidence: 'high',
  nutritionPer100g: {
    caloriesKcal: 352,
    proteinG: 6.9,
    carbohydrateG: 78,
    fatG: 0.5,
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
};

const UNMATCHED: UnmatchedIngredient[] = [];

describe('buildNutritionPrompt — sort determinism', () => {
  it('produces identical XML for same meal items regardless of input order', () => {
    const itemA: DecomposedMealItem = {
      name: 'Cơm',
      ingredients: [
        {
          name: 'gạo',
          estimatedGrams: 100,
          cookingMethod: 'nấu',
          userFacingUnit: null,
        },
        {
          name: 'thịt bò',
          estimatedGrams: 50,
          cookingMethod: 'xào',
          userFacingUnit: null,
        },
      ],
    };

    const itemB: DecomposedMealItem = {
      name: 'Cơm',
      ingredients: [
        {
          name: 'gạo',
          estimatedGrams: 100,
          cookingMethod: 'nấu',
          userFacingUnit: null,
        },
        {
          name: 'rau muống',
          estimatedGrams: 80,
          cookingMethod: 'luộc',
          userFacingUnit: null,
        },
      ],
    };

    const matched: MatchedIngredient[] = [{ ...MATCHED_INGREDIENT }];

    const prompt1 = buildNutritionPrompt(
      [itemA, itemB],
      matched,
      UNMATCHED,
      USER_CONTEXT
    );

    const prompt2 = buildNutritionPrompt(
      [itemB, itemA],
      matched,
      UNMATCHED,
      USER_CONTEXT
    );

    expect(prompt1).toBe(prompt2);
  });

  it('different meal item names sort alphabetically (existing behaviour)', () => {
    const itemA: DecomposedMealItem = {
      name: 'Cháo',
      ingredients: [
        {
          name: 'gạo',
          estimatedGrams: 150,
          cookingMethod: null,
          userFacingUnit: null,
        },
      ],
    };

    const itemB: DecomposedMealItem = {
      name: 'Bún',
      ingredients: [
        {
          name: 'bún',
          estimatedGrams: 200,
          cookingMethod: null,
          userFacingUnit: null,
        },
      ],
    };

    const matched: MatchedIngredient[] = [{ ...MATCHED_INGREDIENT }];

    const prompt1 = buildNutritionPrompt(
      [itemA, itemB],
      matched,
      UNMATCHED,
      USER_CONTEXT
    );

    const prompt2 = buildNutritionPrompt(
      [itemB, itemA],
      matched,
      UNMATCHED,
      USER_CONTEXT
    );

    expect(prompt1).toBe(prompt2);
  });
});
