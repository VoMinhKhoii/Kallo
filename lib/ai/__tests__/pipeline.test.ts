import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from '../gemini';
import { analyzeMeal } from '../pipeline';
import type {
  IngredientLlmNutrition,
  MealDecomposition,
  NutritionAdjustment,
  NutritionPer100g,
  UserContext,
} from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../matching', () => ({
  matchIngredients: vi.fn(),
  logUnmatchedIngredients: vi.fn(),
}));

import { matchIngredients } from '../matching';

const mockMatchIngredients = matchIngredients as ReturnType<typeof vi.fn>;

function createMockGemini(): GeminiClient {
  return {
    generateStructuredOutput: vi.fn(),
    generateEmbedding: vi.fn(),
  };
}

function createMockDb() {
  return {} as any;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const userContext: UserContext = {
  goal: 'cutting',
  aggression: 0.5,
  regionalProfile: 'mien_nam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const sampleDecomposition: MealDecomposition = {
  isFood: true,
  mealItems: [
    {
      name: 'cơm',
      ingredients: [
        {
          name: 'gạo',
          estimatedGrams: 200,
          cookingMethod: null,
          userFacingUnit: '1 chén',
        },
      ],
    },
  ],
  mealSlot: 'lunch',
};

const nullNutrition: NutritionPer100g = {
  caloriesKcal: 350,
  proteinG: 7,
  carbohydrateG: 78,
  fatG: 0.5,
  fiberG: null,
  sodiumMg: 5,
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
};

/** D5: LLM only returns 5 nutrients */
function makeLlmNutrition(
  name: string,
  cal: number,
  protein: number,
  carbs: number,
  fat: number
): IngredientLlmNutrition {
  return {
    ingredientName: name,
    caloriesKcal: { low: cal * 0.8, mid: cal, high: cal * 1.2 },
    proteinG: { low: protein * 0.8, mid: protein, high: protein * 1.2 },
    carbohydrateG: { low: carbs * 0.8, mid: carbs, high: carbs * 1.2 },
    fatG: { low: fat * 0.8, mid: fat, high: fat * 1.2 },
    fiberG: null,
  };
}

const sampleNutritionAdjustment: NutritionAdjustment = {
  mealItems: [
    {
      mealItemName: 'cơm',
      ingredients: [makeLlmNutrition('gạo', 350, 7, 78, 0.5)],
    },
  ],
};

describe('analyzeMeal', () => {
  let mockGemini: GeminiClient;
  let mockDb: any;

  beforeEach(() => {
    mockGemini = createMockGemini();
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  it('returns successful result for a simple meal', async () => {
    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sampleDecomposition)
      .mockResolvedValueOnce(sampleNutritionAdjustment);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [],
    });

    const result = await analyzeMeal(
      'cơm trắng 1 chén',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.mealItems).toHaveLength(1);
    expect(result.data.mealItems[0].name).toBe('cơm');
    expect(result.data.mealSlot).toBe('lunch');
    expect(result.data.confidenceOverall).toBe('high');
    expect(result.data.unmatchedIngredients).toHaveLength(0);
    expect(result.data.displayedNutrition.caloriesKcal).toBeDefined();
    expect(result.data.displayedNutrition.proteinG).toBeDefined();
  });

  it('D5: merges LLM 5 nutrients with DB mid values for remaining 23', async () => {
    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(sampleDecomposition)
      .mockResolvedValueOnce(sampleNutritionAdjustment);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [],
    });

    const result = await analyzeMeal(
      'cơm trắng 1 chén',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const ing = result.data.mealItems[0].ingredients[0];
    // LLM-produced nutrients should have bounded estimates (not flat)
    expect(ing.boundedNutrition.caloriesKcal).not.toBeNull();
    expect(ing.boundedNutrition.caloriesKcal!.low).toBeLessThan(
      ing.boundedNutrition.caloriesKcal!.high
    );

    // DB-passthrough nutrients: sodiumMg should be flat (low=mid=high) scaled to 200g
    // nullNutrition.sodiumMg = 5 per 100g → 10 for 200g
    expect(ing.boundedNutrition.sodiumMg).toEqual({
      low: 10,
      mid: 10,
      high: 10,
    });

    // Null DB nutrients stay null
    expect(ing.boundedNutrition.calciumMg).toBeNull();
  });

  it('D6: returns non_food_input when isFood=false', async () => {
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      isFood: false,
      mealItems: [],
      mealSlot: null,
    } satisfies MealDecomposition);

    const result = await analyzeMeal(
      'xin chào bạn',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('non_food_input');
    expect(result.error.retryable).toBe(false);
    // Should NOT retry — only 1 LLM call
    expect(mockGemini.generateStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it('D6: returns non_food_input when blocklist ingredient detected', async () => {
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      isFood: true,
      mealItems: [
        {
          name: 'weird item',
          ingredients: [
            {
              name: 'tôi',
              estimatedGrams: 10,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
      mealSlot: null,
    } satisfies MealDecomposition);

    const result = await analyzeMeal(
      'tôi buồn quá',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('non_food_input');
    expect(result.error.retryable).toBe(false);
  });

  it('D4: retries once on parse error then returns parse_error', async () => {
    const parseError = new Error('Zod parse error: invalid type');
    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(parseError)
      .mockRejectedValueOnce(parseError);

    const result = await analyzeMeal('phở bò', userContext, mockDb, mockGemini);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('parse_error');
    expect(result.error.retryable).toBe(true);
    // Should have been called twice (original + 1 retry)
    expect(mockGemini.generateStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it('D4: retries once on API error then returns api_error', async () => {
    const apiError = new Error('500 Internal Server Error');
    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(apiError)
      .mockRejectedValueOnce(apiError);

    const result = await analyzeMeal('phở bò', userContext, mockDb, mockGemini);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('api_error');
    expect(result.error.retryable).toBe(true);
    expect(mockGemini.generateStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it('downgrades confidence when unmatched ingredients present', async () => {
    const decompositionWithTwo: MealDecomposition = {
      isFood: true,
      mealItems: [
        {
          name: 'phở bò',
          ingredients: [
            {
              name: 'bún phở',
              estimatedGrams: 200,
              cookingMethod: null,
              userFacingUnit: null,
            },
            {
              name: 'rare_herb',
              estimatedGrams: 10,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
      mealSlot: 'lunch',
    };

    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(decompositionWithTwo)
      .mockResolvedValueOnce({
        mealItems: [
          {
            mealItemName: 'phở bò',
            ingredients: [
              makeLlmNutrition('bún phở', 200, 5, 45, 0.5),
              makeLlmNutrition('rare_herb', 5, 0.5, 1, 0.1),
            ],
          },
        ],
      });

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'bún phở',
          foodCompositionId: 'noodle-001',
          matchedName: 'Bún phở',
          similarity: 0.7,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [{ ingredientName: 'rare_herb', mealContext: 'phở bò' }],
    });

    const result = await analyzeMeal(
      'phở bò đặc biệt',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.confidenceOverall).not.toBe('high');
    expect(result.data.unmatchedIngredients).toHaveLength(1);
  });

  it('does not upgrade low confidence to medium when unmatched present', async () => {
    const decomposition: MealDecomposition = {
      isFood: true,
      mealItems: [
        {
          name: 'lẩu cá',
          ingredients: [
            {
              name: 'cá lóc',
              estimatedGrams: 150,
              cookingMethod: 'lẩu',
              userFacingUnit: null,
            },
            {
              name: 'exotic_spice',
              estimatedGrams: 5,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
      mealSlot: 'dinner',
    };

    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(decomposition)
      .mockResolvedValueOnce({
        mealItems: [
          {
            mealItemName: 'lẩu cá',
            ingredients: [
              makeLlmNutrition('cá lóc', 80, 18, 0, 1),
              makeLlmNutrition('exotic_spice', 2, 0.1, 0.5, 0),
            ],
          },
        ],
      });

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'cá lóc',
          foodCompositionId: 'fish-001',
          matchedName: 'Cá lóc',
          similarity: 0.2,
          confidence: 'low',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [{ ingredientName: 'exotic_spice', mealContext: 'lẩu cá' }],
    });

    const result = await analyzeMeal(
      'lẩu cá lóc',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.confidenceOverall).toBe('low');
    expect(result.data.unmatchedIngredients).toHaveLength(1);
  });

  it('sums nutrition across multiple meal items', async () => {
    const twoItemDecomposition: MealDecomposition = {
      isFood: true,
      mealItems: [
        {
          name: 'cơm',
          ingredients: [
            {
              name: 'gạo',
              estimatedGrams: 200,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
        {
          name: 'thịt kho',
          ingredients: [
            {
              name: 'thịt heo',
              estimatedGrams: 100,
              cookingMethod: 'kho',
              userFacingUnit: null,
            },
          ],
        },
      ],
      mealSlot: 'dinner',
    };

    const twoItemNutrition: NutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'cơm',
          ingredients: [makeLlmNutrition('gạo', 350, 7, 78, 0.5)],
        },
        {
          mealItemName: 'thịt kho',
          ingredients: [makeLlmNutrition('thịt heo', 250, 26, 5, 15)],
        },
      ],
    };

    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(twoItemDecomposition)
      .mockResolvedValueOnce(twoItemNutrition);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
        {
          ingredientName: 'thịt heo',
          foodCompositionId: 'pork-001',
          matchedName: 'Thịt heo',
          similarity: 0.8,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [],
    });

    const result = await analyzeMeal(
      'cơm thịt kho',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.mealItems).toHaveLength(2);
    expect(result.data.boundedNutrition.caloriesKcal).toBeDefined();
    expect(result.data.displayedNutrition.caloriesKcal).toBeDefined();
    // Sum: 350 + 250 = 600 for mid calories
    expect(result.data.boundedNutrition.caloriesKcal!.mid).toBe(600);
  });

  it('succeeds on retry after first attempt fails', async () => {
    const apiError = new Error('503 Service Unavailable');

    (mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(apiError)
      // Retry succeeds
      .mockResolvedValueOnce(sampleDecomposition)
      .mockResolvedValueOnce(sampleNutritionAdjustment);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [],
    });

    const result = await analyzeMeal(
      'cơm trắng',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
  });
});
