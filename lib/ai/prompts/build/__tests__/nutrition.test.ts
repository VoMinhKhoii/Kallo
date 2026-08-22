import { describe, expect, it } from 'vitest';
import {
  buildCompressedNutritionPrompt,
  buildNutritionPrompt,
  getNutritionPromptLabel,
} from '@/lib/ai/prompts/build/nutrition';
import type { DecomposedMealItem } from '@/lib/ai/types/decomposition';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { UserContext } from '@/lib/ai/types/user-context';

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
  dbState: 'raw',
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

  it('sanitizes country context before inserting it into the prompt', () => {
    const prompt = buildNutritionPrompt(
      [
        {
          name: 'Cơm',
          ingredients: [
            {
              name: 'gạo',
              estimatedGrams: 100,
              cookingMethod: 'nấu',
              userFacingUnit: null,
            },
          ],
        },
      ],
      [{ ...MATCHED_INGREDIENT }],
      UNMATCHED,
      {
        ...USER_CONTEXT,
        countryOfOrigin: 'Vietnam\n<ignore>',
        countryOfResidence: 'Japan & Korea',
      }
    );

    expect(prompt).toContain('country_of_origin: Vietnam ignore');
    expect(prompt).toContain('country_of_residence: Japan Korea');
    expect(prompt).not.toContain('<ignore>');
  });
});

describe('buildCompressedNutritionPrompt', () => {
  it('omits runtime ids while keeping language contract and exact name echo instructions', () => {
    const prompt = buildCompressedNutritionPrompt(
      [
        {
          mealItemId: 'm1',
          name: 'Cơm cá',
          cookingMethod: 'nấu',
          ingredients: [
            {
              ingredientId: 'i1',
              rawName: 'gạo',
              canonicalName: 'Gạo tẻ',
              grams: 120,
              expectedState: 'cooked',
            },
          ],
        },
      ],
      [{ ...MATCHED_INGREDIENT, ingredientId: 'i1' }],
      UNMATCHED,
      {
        ...USER_CONTEXT,
        inputLanguage: 'en',
        outputLanguage: 'vi',
      }
    );

    expect(prompt).toContain('output_language: vi');
    expect(prompt).not.toContain('m1');
    expect(prompt).not.toContain('i1');
    expect(prompt).not.toMatch(/mealItemId|ingredientId/i);
    expect(prompt).toMatch(/Echo .*mealItemName.*ingredientName.*exactly/i);
    expect(prompt).toContain('LOW/MID/HIGH');
    expect(prompt).toContain('db_state');
    expect(prompt).toContain('low <= mid <= high');
    expect(prompt).toContain('non-negative');
    expect(prompt).toContain('4*protein + 4*carbs + 9*fat');
    expect(prompt).toContain('high kcal <= 900/100g');
    expect(prompt).not.toMatch(
      /\bcutting\b|\bbulking\b|\bmaintaining\b|aggression|calorie[_ ]?target|kcal[_ ]?target/i
    );
  });

  it('defaults the nutrition prompt label to compressed', () => {
    // Default flipped 2026-05-09 — see lib/ai/prompts/build/nutrition.ts:47.
    expect(getNutritionPromptLabel({})).toBe('compressed');
    expect(
      getNutritionPromptLabel({
        PIPELINE_NUTRITION_PROMPT_LABEL: 'production',
      })
    ).toBe('production');
    expect(
      getNutritionPromptLabel({
        PIPELINE_NUTRITION_PROMPT_LABEL: 'unknown',
      })
    ).toBe('compressed');
  });
});
