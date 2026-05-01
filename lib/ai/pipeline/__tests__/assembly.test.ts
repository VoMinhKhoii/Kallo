import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '../../__tests__/test-helpers';
import type {
  BoundedEstimate,
  MatchedIngredient,
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

function makeMatch(name: string): MatchedIngredient {
  return {
    ingredientId: `id-${name}`,
    ingredientName: name,
    foodCompositionId: `fc-${name}`,
    matchedName: name,
    similarity: 0.9,
    confidence: 'high',
    nutritionPer100g: NULL_NUTRITION_VALUES,
    dbState: 'raw',
  };
}

function makeDecomposition(
  items: {
    name: string;
    ingredients: {
      ingredientId: string;
      name: string;
      estimatedGrams: number;
      cookingMethod: string | null;
    }[];
  }[]
): MealDecomposition {
  return {
    isFood: true,
    mealSlot: 'dinner',
    mealItems: items.map((item) => ({
      name: item.name,
      ingredients: item.ingredients.map((ing) => ({
        ...ing,
        userFacingUnit: null,
      })),
    })),
  };
}

function makeLlmNutrition(
  ingredientName: string,
  mealItemName: string,
  overrides: { caloriesKcal?: BoundedEstimate } = {}
): NutritionAdjustment {
  return {
    mealItems: [
      {
        mealItemId: 'meal-1',
        mealItemName,
        ingredients: [
          {
            ingredientId: 'ing-1',
            ingredientName,
            caloriesKcal: overrides.caloriesKcal ?? {
              low: 100,
              mid: 150,
              high: 200,
            },
            proteinG: { low: 5, mid: 10, high: 15 },
            carbohydrateG: { low: 10, mid: 20, high: 30 },
            fatG: { low: 1, mid: 2, high: 3 },
          },
        ],
      },
    ],
  };
}

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

    const { result } = assembleResult(
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

describe('assembleResult — dbState-aware DB scaling', () => {
  it('uses estimatedGrams (not raw-converted) for DB scaling when dbState is "cooked"', () => {
    const matched: MatchedIngredient[] = [
      {
        ...makeMatch('thịt bò bắp'),
        ingredientId: 'ing-1',
        dbState: 'cooked',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, fiberG: 10 },
      },
    ];
    const decomp = makeDecomposition([
      {
        name: 'Phở bò',
        ingredients: [
          {
            ingredientId: 'ing-1',
            name: 'thịt bò bắp',
            estimatedGrams: 80,
            cookingMethod: 'kho',
          },
        ],
      },
    ]);
    const llm = makeLlmNutrition('thịt bò bắp', 'Phở bò', {
      caloriesKcal: { low: 100, mid: 150, high: 200 },
    });

    const { result, metrics } = assembleResult(
      decomp,
      llm,
      matched,
      [],
      userContext
    );
    const ing = result.mealItems[0].ingredients[0];

    expect(ing.boundedNutrition.fiberG?.mid).toBeCloseTo(8.0, 5);
    expect(ing.rawEquivalentGrams).toBe(80);
    expect(metrics.cookedToRawFactorFires).toBe(0);
  });

  it('applies convertCookedToRaw when dbState === "raw"', () => {
    const matched: MatchedIngredient[] = [
      {
        ...makeMatch('gạo tẻ'),
        ingredientId: 'ing-1',
        dbState: 'raw',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, fiberG: 10 },
      },
    ];
    const decomp = makeDecomposition([
      {
        name: 'Cơm',
        ingredients: [
          {
            ingredientId: 'ing-1',
            name: 'gạo tẻ',
            estimatedGrams: 200,
            cookingMethod: 'nấu',
          },
        ],
      },
    ]);
    const llm = makeLlmNutrition('gạo tẻ', 'Cơm', {
      caloriesKcal: { low: 100, mid: 150, high: 200 },
    });

    const { result, metrics } = assembleResult(
      decomp,
      llm,
      matched,
      [],
      userContext
    );
    const ing = result.mealItems[0].ingredients[0];

    expect(ing.boundedNutrition.fiberG?.mid).toBeCloseTo(7.6, 1);
    expect(ing.rawEquivalentGrams).toBe(76);
    expect(metrics.cookedToRawFactorFires).toBe(1);
  });

  it('treats dbState === "unknown" as legacy fallback', () => {
    const matched: MatchedIngredient[] = [
      {
        ...makeMatch('cá'),
        ingredientId: 'ing-1',
        dbState: 'unknown',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, fiberG: 10 },
      },
    ];
    const decomp = makeDecomposition([
      {
        name: 'Cá kho',
        ingredients: [
          {
            ingredientId: 'ing-1',
            name: 'cá',
            estimatedGrams: 100,
            cookingMethod: 'kho',
          },
        ],
      },
    ]);
    const llm = makeLlmNutrition('cá', 'Cá kho', {
      caloriesKcal: { low: 100, mid: 120, high: 140 },
    });

    const { result, metrics } = assembleResult(
      decomp,
      llm,
      matched,
      [],
      userContext
    );
    const ing = result.mealItems[0].ingredients[0];

    expect(ing.rawEquivalentGrams).toBe(80);
    expect(ing.boundedNutrition.fiberG?.mid).toBeCloseTo(8.0, 5);
    expect(metrics.cookedToRawFactorFires).toBe(1);
  });
});

describe('assembleResult — IngredientNutrition output', () => {
  it('returns unified four-macro ingredient nutrition records for shadow/eval consumers', () => {
    const matched: MatchedIngredient[] = [
      {
        ...makeMatch('thịt bò bắp'),
        ingredientId: 'ing-1',
        foodCompositionId: 'fc-beef',
        dbState: 'cooked',
      },
    ];
    const decomp = makeDecomposition([
      {
        name: 'Phở bò',
        ingredients: [
          {
            ingredientId: 'ing-1',
            name: 'thịt bò bắp',
            estimatedGrams: 80,
            cookingMethod: 'kho',
          },
        ],
      },
    ]);
    const llm = makeLlmNutrition('thịt bò bắp', 'Phở bò', {
      caloriesKcal: { low: 200, mid: 150, high: 100 },
    });

    const output = assembleResult(decomp, llm, matched, [], userContext);

    expect(output.ingredientNutrition).toEqual([
      {
        ingredientId: 'ing-1',
        matchedDbId: 'fc-beef',
        caloriesKcal: { low: 100, mid: 150, high: 200 },
        proteinG: { low: 5, mid: 10, high: 15 },
        carbohydrateG: { low: 10, mid: 20, high: 30 },
        fatG: { low: 1, mid: 2, high: 3 },
      },
    ]);
  });
});
