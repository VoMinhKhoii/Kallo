import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini } from '@/lib/ai/__fixtures__/test-helpers';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { MealDecomposition } from '@/lib/ai/types/decomposition';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import type {
  IngredientLlmNutrition,
  NutritionAdjustment,
} from '@/lib/ai/types/nutrition-adjustment';
import type { UserContext } from '@/lib/ai/types/user-context';
import { Errors } from '@/lib/errors/catalog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/ai/matching/retrieve/legacy/cascade', () => ({
  matchIngredients: vi.fn(),
}));

vi.mock('@/lib/ai/matching/unmatched-log', () => ({
  logUnmatchedIngredients: vi.fn(),
}));

import { matchIngredients } from '@/lib/ai/matching/retrieve/legacy/cascade';

const mockMatchIngredients = matchIngredients as ReturnType<typeof vi.fn>;

function createMockDb() {
  return {} as any;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

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
      ingredients: [makeLlmNutrition('Gạo', 350, 7, 78, 0.5)],
    },
  ],
};

describe('analyzeMeal', () => {
  let mockGemini: GeminiClient;
  let mockDb: any;

  /** Mock Call 1 (streaming decomposition) + Call 2 (streaming nutrition) */
  function mockLlmCalls(
    decomposition: MealDecomposition,
    nutrition: NutritionAdjustment
  ) {
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(decomposition);
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(nutrition);
  }

  beforeEach(() => {
    mockGemini = createMockGemini();
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  it('returns successful result for a simple meal', async () => {
    mockLlmCalls(sampleDecomposition, sampleNutritionAdjustment);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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

  it('surfaces pipeline timeout messages as retryable api errors', async () => {
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(Errors.pipelineTimeout());

    const result = await analyzeMeal(
      'phở bò tái',
      userContext,
      mockDb,
      mockGemini
    );

    expect(result).toEqual({
      success: false,
      error: {
        type: 'api_error',
        message: 'Analysis took too long. Please try again.',
        retryable: true,
      },
    });
  });

  it('D5: merges LLM 5 nutrients with DB mid values for remaining 23', async () => {
    mockLlmCalls(sampleDecomposition, sampleNutritionAdjustment);

    mockMatchIngredients.mockImplementationOnce(
      (ingredients: Array<{ name: string; ingredientId?: string }>) =>
        Promise.resolve({
          matched: [
            {
              ingredientId: ingredients[0]?.ingredientId,
              ingredientName: 'Gạo',
              foodCompositionId: 'rice-001',
              matchedName: 'Gạo tẻ',
              similarity: 0.85,
              confidence: 'high',
              nutritionPer100g: nullNutrition,
              dbState: 'raw',
            },
          ],
          unmatched: [],
        })
    );

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
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      mealItems: [
        {
          mealItemName: 'Phở bò',
          ingredients: [
            makeLlmNutrition('Bún phở', 200, 5, 45, 0.5),
            makeLlmNutrition('Rare_herb', 5, 0, 1.25, 0),
          ],
        },
      ],
    });

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Bún phở',
          foodCompositionId: 'noodle-001',
          matchedName: 'Bún phở',
          similarity: 0.7,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      mealItems: [
        {
          mealItemName: 'Lẩu cá',
          ingredients: [
            makeLlmNutrition('Cá lóc', 80, 18, 0, 1),
            makeLlmNutrition('Exotic_spice', 2, 0, 0.5, 0),
          ],
        },
      ],
    });

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Cá lóc',
          foodCompositionId: 'fish-001',
          matchedName: 'Cá lóc',
          similarity: 0.2,
          confidence: 'low',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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
          ingredients: [makeLlmNutrition('Gạo', 350, 7, 78, 0.5)],
        },
        {
          mealItemName: 'Thịt kho',
          ingredients: [makeLlmNutrition('Thịt heo', 250, 26, 5, 15)],
        },
      ],
    };

    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(twoItemDecomposition);
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(twoItemNutrition);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
        },
        {
          ingredientName: 'Thịt heo',
          foodCompositionId: 'pork-001',
          matchedName: 'Thịt lợn nạc',
          similarity: 0.8,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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
    // Post-2026-05-13 contract: caloriesKcal is derived from the macro identity
    // 4P + 4C + 9F per bound (not echoed from the LLM). For these fixtures:
    //   Gạo:     4×7  + 4×78 + 9×0.5 = 344.5
    //   Thịt heo: 4×26 + 4×5  + 9×15  = 259
    //   Total:   603.5
    expect(result.data.boundedNutrition.caloriesKcal!.mid).toBeCloseTo(
      603.5,
      1
    );
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
            makeLlmNutrition('Thịt heo', 250, 26, 5, 15),
            {
              ingredientName: 'Dầu ăn',
              caloriesKcal: { low: 135, mid: 135, high: 135 },
              proteinG: { low: 0, mid: 0, high: 0 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 15, mid: 15, high: 15 },
            },
          ],
        },
        {
          mealItemName: 'Xào rau',
          ingredients: [
            makeLlmNutrition('Rau cải', 30, 2, 5, 0.5),
            {
              ingredientName: 'Dầu ăn',
              caloriesKcal: { low: 90, mid: 90, high: 90 },
              proteinG: { low: 0, mid: 0, high: 0 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 10, mid: 10, high: 10 },
            },
          ],
        },
      ],
    };

    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sharedIngDecomposition);
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sharedIngNutrition);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Thịt heo',
          foodCompositionId: 'pork-001',
          matchedName: 'Thịt lợn nạc',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
        },
        {
          ingredientName: 'Dầu ăn',
          foodCompositionId: 'oil-001',
          matchedName: 'Dầu đậu nành',
          similarity: 0.9,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
        },
        {
          ingredientName: 'Rau cải',
          foodCompositionId: 'veg-001',
          matchedName: 'Rau cải',
          similarity: 0.8,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
        },
        {
          ingredientName: 'Dầu ăn',
          foodCompositionId: 'oil-001',
          matchedName: 'Dầu đậu nành',
          similarity: 0.9,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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

    // "dầu ăn" in thịt kho trứng should have 135 kcal mid (natural name, not aliased)
    const khoOil = result.data.mealItems[0].ingredients.find(
      (i) => i.ingredientName === 'Dầu ăn'
    );
    expect(khoOil).toBeDefined();
    expect(khoOil!.boundedNutrition.caloriesKcal!.mid).toBe(135);

    // "dầu ăn" in xào rau should have 90 kcal mid
    const xaoOil = result.data.mealItems[1].ingredients.find(
      (i) => i.ingredientName === 'Dầu ăn'
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
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sampleNutritionAdjustment);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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
          ingredients: [makeLlmNutrition('Gạo', 0, 0, 0, 0)],
        },
      ],
    };

    // First Call 1 stream resolves normally
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sampleDecomposition);
    // First Call 2 returns 0 calories → triggers retry
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(zeroCalNutrition);
    // Retry Call 2 returns valid result
    (
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(sampleNutritionAdjustment);

    mockMatchIngredients.mockResolvedValueOnce({
      matched: [
        {
          ingredientName: 'Gạo',
          foodCompositionId: 'rice-001',
          matchedName: 'Gạo tẻ',
          similarity: 0.85,
          confidence: 'high',
          nutritionPer100g: nullNutrition,
          dbState: 'raw',
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
    // generateStructuredOutputStream: 1 (decomp) + 2 (nutrition original + retry) = 3
    expect(
      mockGemini.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledTimes(3);
  });
});
