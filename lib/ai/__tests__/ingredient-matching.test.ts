import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from '../gemini';
import type { DecomposedIngredient } from '../types';
import {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  matchIngredients,
} from '../ingredient-matching';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockDb() {
  return {
    execute: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mock GeminiClient
// ---------------------------------------------------------------------------

function createMockGemini(): GeminiClient {
  return {
    generateStructuredOutput: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleIngredient: DecomposedIngredient = {
  name: 'thịt bò',
  estimatedGrams: 150,
  cookingMethod: 'luộc',
  userFacingUnit: '1 miếng',
};

const sampleFuzzyResult = {
  id: 'beef-001',
  name_primary: 'Thịt bò',
  name_alt: ['Bò'],
  name_en: 'Beef',
  state: 'raw',
  similarity: 0.75,
};

const sampleNutritionRow = {
  id: 'beef-001',
  calories_kcal: '250',
  protein_g: '26',
  carbohydrate_g: '0',
  fat_g: '15',
  fiber_g: null,
  sodium_mg: '72',
  calcium_mg: '12',
  iron_mg: '2.6',
  magnesium_mg: '21',
  phosphorus_mg: '198',
  potassium_mg: '318',
  zinc_mg: '4.8',
  copper_mcg: '70',
  manganese_mg: null,
  beta_carotene_mcg: null,
  vitamin_a_mcg: null,
  vitamin_d_mcg: null,
  vitamin_e_mg: null,
  vitamin_k_mcg: null,
  vitamin_c_mg: '0',
  vitamin_b1_mg: '0.08',
  vitamin_b2_mg: '0.15',
  vitamin_pp_mg: '5.1',
  vitamin_b5_mg: null,
  vitamin_b6_mg: null,
  vitamin_b9_mcg: null,
  vitamin_b12_mcg: null,
  vitamin_h_mcg: null,
};

describe('classifyConfidence', () => {
  it('returns high for similarity >= 0.6', () => {
    expect(classifyConfidence(0.6)).toBe('high');
    expect(classifyConfidence(0.9)).toBe('high');
  });

  it('returns medium for similarity >= 0.3 and < 0.6', () => {
    expect(classifyConfidence(0.3)).toBe('medium');
    expect(classifyConfidence(0.59)).toBe('medium');
  });

  it('returns low for similarity < 0.3', () => {
    expect(classifyConfidence(0.29)).toBe('low');
    expect(classifyConfidence(0.15)).toBe('low');
  });

  it('threshold constants are correct', () => {
    expect(CONFIDENCE_THRESHOLDS.high).toBe(0.6);
    expect(CONFIDENCE_THRESHOLDS.medium).toBe(0.3);
  });
});

describe('matchIngredients', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockGemini: GeminiClient;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGemini = createMockGemini();
    vi.clearAllMocks();
  });

  it('matches via fuzzy search when similarity is high enough', async () => {
    mockDb.execute
      .mockResolvedValueOnce([sampleFuzzyResult]) // fuzzy match
      .mockResolvedValueOnce([sampleNutritionRow]); // nutrition fetch

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini,
    );

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].foodCompositionId).toBe('beef-001');
    expect(result.matched[0].confidence).toBe('high');
    expect(result.matched[0].nutritionPer100g.caloriesKcal).toBe(250);
    expect(result.matched[0].nutritionPer100g.proteinG).toBe(26);
    // Gemini embedding should NOT be called (fuzzy matched)
    expect(mockGemini.generateEmbedding).not.toHaveBeenCalled();
  });

  it('falls back to vector search when fuzzy returns no results', async () => {
    const vectorResult = { ...sampleFuzzyResult, similarity: 0.55 };

    mockDb.execute
      .mockResolvedValueOnce([]) // fuzzy match: empty
      .mockResolvedValueOnce([vectorResult]) // vector match
      .mockResolvedValueOnce([sampleNutritionRow]); // nutrition fetch

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini,
    );

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].confidence).toBe('medium');
    expect(mockGemini.generateEmbedding).toHaveBeenCalledWith('thịt bò');
  });

  it('returns unmatched when both searches fail', async () => {
    mockDb.execute
      .mockResolvedValueOnce([]) // fuzzy: empty
      .mockResolvedValueOnce([]); // vector: empty

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini,
    );

    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].ingredientName).toBe('thịt bò');
    expect(result.unmatched[0].mealContext).toBe('bún bò Huế');
  });

  it('handles multiple ingredients with mixed results', async () => {
    const ingredients: DecomposedIngredient[] = [
      {
        name: 'gạo',
        estimatedGrams: 200,
        cookingMethod: null,
        userFacingUnit: '1 chén',
      },
      {
        name: 'unknown_food',
        estimatedGrams: 50,
        cookingMethod: null,
        userFacingUnit: null,
      },
    ];

    mockDb.execute
      // Ingredient 1: fuzzy match succeeds
      .mockResolvedValueOnce([
        {
          ...sampleFuzzyResult,
          id: 'rice-001',
          name_primary: 'Gạo',
          similarity: 0.8,
        },
      ])
      .mockResolvedValueOnce([
        { ...sampleNutritionRow, id: 'rice-001', calories_kcal: '350' },
      ])
      // Ingredient 2: both searches fail
      .mockResolvedValueOnce([]) // fuzzy: empty
      .mockResolvedValueOnce([]); // vector: empty

    const result = await matchIngredients(
      ingredients,
      'cơm chiên',
      mockDb as any,
      mockGemini,
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].ingredientName).toBe('gạo');
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].ingredientName).toBe('unknown_food');
  });

  it('parses nutrition values from string to number, null stays null', async () => {
    mockDb.execute
      .mockResolvedValueOnce([sampleFuzzyResult])
      .mockResolvedValueOnce([sampleNutritionRow]);

    const result = await matchIngredients(
      [sampleIngredient],
      'test',
      mockDb as any,
      mockGemini,
    );

    const nutrition = result.matched[0].nutritionPer100g;
    expect(nutrition.caloriesKcal).toBe(250);
    expect(nutrition.proteinG).toBe(26);
    expect(nutrition.fiberG).toBeNull();
    expect(nutrition.manganeseMg).toBeNull();
    expect(nutrition.vitaminCMg).toBe(0);
  });

  it('processes ingredients sequentially (no inter-ingredient dependencies)', async () => {
    const callOrder: string[] = [];
    mockDb.execute.mockImplementation(async () => {
      callOrder.push('db-call');
      return [];
    });

    const ingredients: DecomposedIngredient[] = [
      { name: 'a', estimatedGrams: 10, cookingMethod: null, userFacingUnit: null },
      { name: 'b', estimatedGrams: 20, cookingMethod: null, userFacingUnit: null },
    ];

    await matchIngredients(ingredients, 'test', mockDb as any, mockGemini);

    // Each ingredient: 1 fuzzy call + 1 vector call = 2 calls per ingredient
    // Sequential: a-fuzzy, a-vector, b-fuzzy, b-vector
    expect(mockDb.execute).toHaveBeenCalledTimes(4);
  });
});
