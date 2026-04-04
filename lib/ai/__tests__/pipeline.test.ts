import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini } from '@/lib/ai/__tests__/test-helpers';
import type { GeminiClient } from '@/lib/ai/gemini';
import { extractIngredientNames } from '@/lib/ai/matching/speculative';
import { analyzeMeal } from '@/lib/ai/pipeline';
import type {
  IngredientLlmNutrition,
  MealDecomposition,
  NutritionAdjustment,
  NutritionPer100g,
  UserContext,
} from '@/lib/ai/types';
import { ConcurrencyQueue } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/ai/matching/cascade', () => ({
  aggregateConcurrentMatches: vi.fn(),
}));

import { aggregateConcurrentMatches } from '@/lib/ai/matching/cascade';

const mockAggregateConcurrentMatches = aggregateConcurrentMatches as ReturnType<
  typeof vi.fn
>;

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue([]),
  } as any;
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

/** D5: LLM only returns 4 macros */
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
  };
}

const sampleNutritionAdjustment: NutritionAdjustment = {
  mealItems: [
    {
      mealItemName: 'Cơm',
      ingredients: [makeLlmNutrition('Gạo tẻ', 350, 7, 78, 0.5)],
    },
  ],
};

describe('analyzeMeal', () => {
  let mockGemini: GeminiClient;
  let mockDb: any;

  /** Mock Call 1 (streaming decomposition) + Call 2 (nutrition) */
  function mockLlmCalls(
    decomposition: MealDecomposition,
    nutrition: NutritionAdjustment
  ) {
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(decomposition);
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(nutrition);
  }

  beforeEach(() => {
    mockGemini = createMockGemini();
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  it('returns successful result for a simple meal', async () => {
    mockLlmCalls(sampleDecomposition, sampleNutritionAdjustment);

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo',
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
    expect(result.data.mealItems[0].name).toBe('Cơm');
    expect(result.data.mealSlot).toBe('lunch');
    expect(result.data.confidenceOverall).toBe('high');
    expect(result.data.unmatchedIngredients).toHaveLength(0);
    expect(result.data.displayedNutrition.caloriesKcal).toBeDefined();
    expect(result.data.displayedNutrition.proteinG).toBeDefined();
  });

  it('D5: merges LLM 5 nutrients with DB mid values for remaining 23', async () => {
    mockLlmCalls(sampleDecomposition, sampleNutritionAdjustment);

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo tẻ',
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
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
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
    // Should NOT retry — only 1 LLM call (streaming decomposition)
    expect(mockGemini.generateStructuredOutputStream).toHaveBeenCalledTimes(1);
  });

  it('D6: returns non_food_input when blocklist ingredient detected', async () => {
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
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
    (mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(parseError)
      .mockRejectedValueOnce(parseError);

    const result = await analyzeMeal('phở bò', userContext, mockDb, mockGemini);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('parse_error');
    expect(result.error.retryable).toBe(true);
    // Should have been called twice (original + 1 retry)
    expect(mockGemini.generateStructuredOutputStream).toHaveBeenCalledTimes(2);
  });

  it('D4: API errors surface immediately without retry', async () => {
    const apiError = new Error('500 Internal Server Error');
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(apiError);

    const result = await analyzeMeal('phở bò', userContext, mockDb, mockGemini);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('api_error');
    expect(result.error.retryable).toBe(true);
    // API errors no longer trigger pipeline retry (only parse errors do)
    expect(mockGemini.generateStructuredOutputStream).toHaveBeenCalledTimes(1);
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

    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(decompositionWithTwo);
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      mealItems: [
        {
          mealItemName: 'Phở bò',
          ingredients: [
            makeLlmNutrition('Bún phở', 200, 5, 45, 0.5),
            makeLlmNutrition('Rare_herb', 5, 0.5, 1, 0.1),
          ],
        },
      ],
    });

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Bún phở',
          foodCompositionId: 'noodle-001',
          matchedName: 'Bún phở',
          similarity: 0.7,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [{ ingredientName: 'Rare_herb', mealContext: 'Phở bò' }],
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

    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(decomposition);
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      mealItems: [
        {
          mealItemName: 'Lẩu cá',
          ingredients: [
            makeLlmNutrition('Cá lóc', 80, 18, 0, 1),
            makeLlmNutrition('Exotic_spice', 2, 0.1, 0.5, 0),
          ],
        },
      ],
    });

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Cá lóc',
          foodCompositionId: 'fish-001',
          matchedName: 'Cá lóc',
          similarity: 0.2,
          confidence: 'low',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [{ ingredientName: 'Exotic_spice', mealContext: 'Lẩu cá' }],
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
          mealItemName: 'Cơm',
          ingredients: [makeLlmNutrition('Gạo tẻ', 350, 7, 78, 0.5)],
        },
        {
          mealItemName: 'Thịt kho',
          ingredients: [makeLlmNutrition('Thịt lợn nạc', 250, 26, 5, 15)],
        },
      ],
    };

    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(twoItemDecomposition);
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(twoItemNutrition);

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo tẻ',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
        {
          ingredientName: 'Thịt lợn nạc',
          foodCompositionId: 'pork-001',
          matchedName: 'Thịt lợn nạc',
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

  it('Fix 2: same ingredient in multiple meal items gets per-meal-item LLM bounds', async () => {
    const sharedIngDecomposition: MealDecomposition = {
      isFood: true,
      mealItems: [
        {
          name: 'thịt kho trứng',
          ingredients: [
            {
              name: 'thịt heo',
              estimatedGrams: 120,
              cookingMethod: 'kho',
              userFacingUnit: null,
            },
            {
              name: 'dầu ăn',
              estimatedGrams: 15,
              cookingMethod: 'kho',
              userFacingUnit: null,
            },
          ],
        },
        {
          name: 'xào rau',
          ingredients: [
            {
              name: 'rau cải',
              estimatedGrams: 150,
              cookingMethod: 'xào',
              userFacingUnit: null,
            },
            {
              name: 'dầu ăn',
              estimatedGrams: 10,
              cookingMethod: 'xào',
              userFacingUnit: null,
            },
          ],
        },
      ],
      mealSlot: 'lunch',
    };

    const sharedIngNutrition: NutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Thịt kho trứng',
          ingredients: [
            makeLlmNutrition('Thịt lợn nạc', 250, 26, 5, 15),
            makeLlmNutrition('Dầu đậu nành', 135, 0, 0, 15), // 15g oil in kho
          ],
        },
        {
          mealItemName: 'Xào rau',
          ingredients: [
            makeLlmNutrition('Rau cải', 30, 2, 5, 0.5),
            makeLlmNutrition('Dầu đậu nành', 90, 0, 0, 10), // 10g oil in xào
          ],
        },
      ],
    };

    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sharedIngDecomposition);
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sharedIngNutrition);

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Thịt lợn nạc',
          foodCompositionId: 'pork-001',
          matchedName: 'Thịt lợn nạc',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
        {
          ingredientName: 'Dầu đậu nành',
          foodCompositionId: 'oil-001',
          matchedName: 'Dầu đậu nành',
          similarity: 0.9,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
        {
          ingredientName: 'Rau cải',
          foodCompositionId: 'veg-001',
          matchedName: 'Rau cải',
          similarity: 0.8,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
        {
          ingredientName: 'Dầu đậu nành',
          foodCompositionId: 'oil-001',
          matchedName: 'Dầu đậu nành',
          similarity: 0.9,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
        },
      ],
      unmatched: [],
    });

    const result = await analyzeMeal(
      'cơm thịt kho trứng, xào rau',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.mealItems).toHaveLength(2);

    // "dầu ăn" aliased to "Dầu đậu nành" in thịt kho trứng should have 135 kcal mid
    const khoOil = result.data.mealItems[0].ingredients.find(
      (i) => i.ingredientName === 'Dầu đậu nành'
    );
    expect(khoOil).toBeDefined();
    expect(khoOil!.boundedNutrition.caloriesKcal!.mid).toBe(135);

    // "dầu ăn" aliased to "Dầu đậu nành" in xào rau should have 90 kcal mid
    const xaoOil = result.data.mealItems[1].ingredients.find(
      (i) => i.ingredientName === 'Dầu đậu nành'
    );
    expect(xaoOil).toBeDefined();
    expect(xaoOil!.boundedNutrition.caloriesKcal!.mid).toBe(90);
  });

  it('succeeds on retry after first attempt fails with parse error', async () => {
    const parseError = new Error('Zod parse error: invalid type');

    (mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(parseError)
      // Retry succeeds
      .mockResolvedValueOnce(sampleDecomposition);
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sampleNutritionAdjustment);

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo tẻ',
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

  it('retries Call 2 when nutrition result has 0 total calories', async () => {
    const zeroCalNutrition: NutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Cơm',
          ingredients: [makeLlmNutrition('Gạo tẻ', 0, 0, 0, 0)],
        },
      ],
    };

    // First Call 1 stream resolves normally
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sampleDecomposition);
    // First Call 2 returns 0 calories → triggers retry
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(zeroCalNutrition);
    // Retry Call 2 returns valid result
    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sampleNutritionAdjustment);

    mockAggregateConcurrentMatches.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo tẻ',
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
    if (!result.success) return;
    // Should have used the retry result (350 kcal), not the 0-calorie result
    expect(result.data.displayedNutrition.caloriesKcal).toBeGreaterThan(0);
    // generateStructuredOutput should have been called twice (original + retry)
    expect(
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledTimes(2);
  });

  it('verifies streaming + concurrent dispatch during decompose stage', async () => {
    const mockDecomposition: MealDecomposition = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Phở bò',
          ingredients: [
            {
              name: 'Bánh phở',
              estimatedGrams: 150,
              cookingMethod: null,
              userFacingUnit: null,
            },
            {
              name: 'Thịt bò',
              estimatedGrams: 50,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
    };

    // Mock streaming generator to manually trigger chunks
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockImplementation(async (_params: any, onChunk: any) => {
      // Simulate streaming chunks
      if (onChunk) {
        onChunk('{"mealItems":[{"ingredients":[{"name":"Bánh phở"');
        onChunk('},{"name":"Thịt bò"}]}]}');
      }
      return mockDecomposition;
    });

    (
      mockGemini.generateStructuredOutput as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      mealItems: [
        {
          mealItemName: 'Phở bò',
          ingredients: [],
        },
      ],
    } as NutritionAdjustment);

    mockAggregateConcurrentMatches.mockResolvedValue({
      matched: [],
      unmatched: [],
    });

    await analyzeMeal('transcription', userContext, mockDb, mockGemini);

    // Verify that aggregateConcurrentMatches was called with 2 promises
    // (one for each unique ingredient name found in the stream)
    expect(mockAggregateConcurrentMatches).toHaveBeenCalled();
    const firstCallArgs = mockAggregateConcurrentMatches.mock.calls[0];
    const matchPromises = firstCallArgs[0];
    expect(matchPromises).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: Concurrency Queue
// ---------------------------------------------------------------------------

describe('ConcurrencyQueue', () => {
  it('correctly limits the number of concurrent tasks', async () => {
    const queue = new ConcurrencyQueue(2);
    let active = 0;
    let maxSeen = 0;

    const task = async () => {
      active++;
      maxSeen = Math.max(maxSeen, active);
      await new Promise((resolve) => setTimeout(resolve, 50));
      active--;
    };

    // Dispatch 5 tasks to a queue with a limit of 2
    await Promise.all([
      queue.add(task),
      queue.add(task),
      queue.add(task),
      queue.add(task),
      queue.add(task),
    ]);

    expect(maxSeen).toBe(2);
    expect(active).toBe(0);
  });

  it('handles rejections and continues processing', async () => {
    const queue = new ConcurrencyQueue(1);

    const successResult = await queue.add(async () => 'ok');
    expect(successResult).toBe('ok');

    await expect(
      queue.add(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    const nextResult = await queue.add(async () => 'still ok');
    expect(nextResult).toBe('still ok');
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: Streaming Parser (Speculative)
// ---------------------------------------------------------------------------

describe('extractIngredientNames', () => {
  it('finds complete ingredient names in partial JSON', () => {
    const seen = new Set<string>();

    const chunk1 = '{"mealItems":[{"ingredients":[{"name":"Gạo"}]}';
    expect(extractIngredientNames(chunk1, seen)).toEqual(['Gạo']);
    expect(seen.has('Gạo')).toBe(true);

    const chunk2 = '{"mealItems":[{"ingredients":[{"name":"Thịt lợn nạc"}]}';
    expect(extractIngredientNames(chunk2, seen)).toEqual(['Thịt lợn nạc']);
    expect(seen.has('Thịt lợn nạc')).toBe(true);
  });

  it('handles name split across chunk boundary (passed as accumulated)', () => {
    const seen = new Set<string>();

    const chunk1 = '{"name":"Thị';
    const chunk2 = 't lợn nạc"}';

    // Step 1: Incomplete token in first call
    expect(extractIngredientNames(chunk1, seen)).toEqual([]);

    // Step 2: Next chunk provides completion in the accumulated string
    const accumulated = chunk1 + chunk2;
    expect(extractIngredientNames(accumulated, seen)).toEqual(['Thịt lợn nạc']);
    expect(seen.has('Thịt lợn nạc')).toBe(true);
  });

  it('handles multi-byte UTF-8 split across boundary', () => {
    const seen = new Set<string>();

    // phở - 'ở' is multi-byte.
    // Let's assume the string is correctly reconstruction in the accumulator
    const chunk1 = '{"name":"ph';
    const chunk2 = 'ở bò"}';

    expect(extractIngredientNames(chunk1, seen)).toEqual([]);
    expect(extractIngredientNames(chunk1 + chunk2, seen)).toEqual(['phở bò']);
  });

  it('ignores incomplete name fields', () => {
    const seen = new Set<string>();
    const chunk = '{"mealItems":[{"ingred';
    expect(extractIngredientNames(chunk, seen)).toEqual([]);
  });
});
