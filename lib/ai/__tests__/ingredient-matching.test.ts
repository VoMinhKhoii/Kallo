import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearNutritionCache } from '../cache/nutrition-cache';
import type { GeminiClient } from '../gemini';
import {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  clearMemoryCache,
  FUZZY_FALLBACK_THRESHOLD,
  FUZZY_SIMILARITY_THRESHOLD,
  matchIngredients,
  rerankCandidates,
  VECTOR_SIMILARITY_THRESHOLD,
} from '../matching';
import type { DecomposedIngredient } from '../types';
import {
  createMockGemini,
  createSourceAwareMockDb,
  extractSqlText,
} from './test-helpers';

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
  it('returns high for similarity >= 0.85', () => {
    expect(classifyConfidence(0.85)).toBe('high');
    expect(classifyConfidence(0.9)).toBe('high');
  });

  it('returns medium for similarity >= 0.7 and < 0.85', () => {
    expect(classifyConfidence(0.7)).toBe('medium');
    expect(classifyConfidence(0.84)).toBe('medium');
  });

  it('returns low for similarity < 0.7', () => {
    expect(classifyConfidence(0.69)).toBe('low');
    expect(classifyConfidence(0.5)).toBe('low');
  });

  it('threshold constants are correct', () => {
    expect(CONFIDENCE_THRESHOLDS.high).toBe(0.85);
    expect(CONFIDENCE_THRESHOLDS.medium).toBe(0.7);
  });

  it('similarity threshold constants are correct', () => {
    expect(FUZZY_SIMILARITY_THRESHOLD).toBe(0.4);
    expect(VECTOR_SIMILARITY_THRESHOLD).toBe(0.7);
    expect(FUZZY_FALLBACK_THRESHOLD).toBe(0.7);
  });
});

describe('matchIngredients', () => {
  let mockGemini: GeminiClient;

  beforeEach(() => {
    mockGemini = createMockGemini();
    clearMemoryCache();
    clearNutritionCache();
    vi.clearAllMocks();
  });

  it('matches via vector search when similarity is high enough', async () => {
    const mockDb = createSourceAwareMockDb({
      fao_vector: [{ ...sampleFuzzyResult, similarity: 0.8 }],
      usda_vector: [],
      nutrition: [sampleNutritionRow],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].foodCompositionId).toBe('beef-001');
    expect(result.matched[0].confidence).toBe('medium');
    expect(result.matched[0].nutritionPer100g.caloriesKcal).toBe(250);
    expect(result.matched[0].nutritionPer100g.proteinG).toBe(26);
  });

  it('falls back to fuzzy search when vector returns no results', async () => {
    const mockDb = createSourceAwareMockDb({
      fao_vector: [],
      usda_vector: [],
      fao_fuzzy: [{ ...sampleFuzzyResult, similarity: 0.75 }],
      usda_fuzzy: [],
      nutrition: [sampleNutritionRow],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].confidence).toBe('medium');
  });

  it('rejects vector match below threshold and falls through to fuzzy', async () => {
    // 0.5 + 0.15 exact-match boost = 0.65, still below 0.70 threshold
    const lowVector = { ...sampleFuzzyResult, similarity: 0.5 };
    const goodFuzzy = { ...sampleFuzzyResult, similarity: 0.75 }; // above 0.7

    const mockDb = createSourceAwareMockDb({
      fao_vector: [lowVector],
      usda_vector: [],
      fao_fuzzy: [goodFuzzy],
      usda_fuzzy: [],
      nutrition: [sampleNutritionRow],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'test',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(1);
    // Single candidate: re-ranking doesn't change similarity
    expect(result.matched[0].similarity).toBe(0.75);
  });

  it('rejects both below threshold as unmatched', async () => {
    // 0.5 + 0.15 exact-match boost = 0.65, below 0.70
    const lowVector = { ...sampleFuzzyResult, similarity: 0.5 };
    // 0.4 + 0.15 = 0.55, below 0.70
    const lowFuzzy = { ...sampleFuzzyResult, similarity: 0.4 };

    const mockDb = createSourceAwareMockDb({
      fao_vector: [lowVector],
      usda_vector: [],
      fao_fuzzy: [lowFuzzy],
      usda_fuzzy: [],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'test',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it('returns unmatched when both searches fail', async () => {
    const mockDb = createSourceAwareMockDb({
      fao_vector: [],
      usda_vector: [],
      fao_fuzzy: [],
      usda_fuzzy: [],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini
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

    // gạo → 0.1-filled embedding (contains digit '1', triggers createSourceAwareMockDb routing).
    // unknown_food → 0-filled embedding (no '1', returns [] from all source-aware routes).
    // This exploits the fact that Drizzle inlines string params (the JSON vector) into the
    // extracted SQL text, but not number params (source_id). So 'q.includes("1")' in
    // createSourceAwareMockDb detects gạo's queries by vector content, not source_id.
    const mockGeminiMixed = createMockGemini({
      generateEmbeddingBatch: vi
        .fn()
        .mockImplementation((texts: string[]) =>
          Promise.resolve(
            texts.map((text) =>
              text.toLowerCase().includes('gạo') ||
              text.toLowerCase().includes('tẻ')
                ? Array(768).fill(0.1)
                : Array(768).fill(0)
            )
          )
        ),
    });

    const riceResult = {
      ...sampleFuzzyResult,
      id: 'rice-001',
      name_primary: 'Gạo',
      similarity: 0.9,
    };
    const mockDb = createSourceAwareMockDb({
      fao_vector: [riceResult],
      usda_vector: [],
      fao_fuzzy: [],
      usda_fuzzy: [],
      nutrition: [
        { ...sampleNutritionRow, id: 'rice-001', calories_kcal: '350' },
      ],
    });

    const result = await matchIngredients(
      ingredients,
      'cơm chiên',
      mockDb as any,
      mockGeminiMixed
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].ingredientName).toBe('gạo');
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].ingredientName).toBe('unknown_food');
  });

  it('parses nutrition values from string to number, null stays null', async () => {
    const mockDb = createSourceAwareMockDb({
      fao_vector: [{ ...sampleFuzzyResult, similarity: 0.8 }],
      usda_vector: [],
      nutrition: [sampleNutritionRow],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'test',
      mockDb as any,
      mockGemini
    );

    const nutrition = result.matched[0].nutritionPer100g;
    expect(nutrition.caloriesKcal).toBe(250);
    expect(nutrition.proteinG).toBe(26);
    expect(nutrition.fiberG).toBeNull();
    expect(nutrition.manganeseMg).toBeNull();
    expect(nutrition.vitaminCMg).toBe(0);
  });

  it('processes ingredients in parallel (no inter-ingredient dependencies)', async () => {
    const callOrder: string[] = [];
    const mockDb = {
      execute: vi.fn().mockImplementation(async (query: unknown) => {
        const queryStr = extractSqlText(query);
        if (queryStr.includes('ingredient_query_embeddings')) {
          return [];
        }
        // Warm-up: embedding cache loading from food_composition
        if (
          queryStr.includes('vietnamese_food_composition') &&
          queryStr.includes('source_id') &&
          queryStr.includes('embedding')
        ) {
          return [];
        }
        callOrder.push('db-call');
        return [];
      }),
    };

    const ingredients: DecomposedIngredient[] = [
      {
        name: 'a',
        estimatedGrams: 10,
        cookingMethod: null,
        userFacingUnit: null,
      },
      {
        name: 'b',
        estimatedGrams: 20,
        cookingMethod: null,
        userFacingUnit: null,
      },
    ];

    await matchIngredients(ingredients, 'test', mockDb as any, mockGemini);

    // 2 ingredients × (2 FAO+USDA vector + 2 FAO+USDA fuzzy fallback) = 8 match calls
    // No matches → batchFetchNutrition gets empty IDs → skips DB call
    expect(callOrder).toHaveLength(8);
  });

  it('rejects fuzzy fallback below 0.7 threshold as unmatched', async () => {
    // 0.4 + 0.15 exact-match boost = 0.55, below 0.70
    const lowFuzzy = { ...sampleFuzzyResult, similarity: 0.4 };

    const mockDb = createSourceAwareMockDb({
      fao_vector: [],
      usda_vector: [],
      fao_fuzzy: [lowFuzzy],
      usda_fuzzy: [],
    });

    const result = await matchIngredients(
      [sampleIngredient],
      'test',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].ingredientName).toBe('thịt bò');
  });

  it('batch-fetches nutrition in 1 query instead of N (N+1 fix)', async () => {
    // 3 ingredients all match via FAO vector → should trigger exactly 1 batch nutrition query
    const ingredients: DecomposedIngredient[] = [
      {
        name: 'gạo tẻ',
        estimatedGrams: 150,
        cookingMethod: 'nấu',
        userFacingUnit: null,
      },
      {
        name: 'thịt bò',
        estimatedGrams: 100,
        cookingMethod: 'luộc',
        userFacingUnit: null,
      },
      {
        name: 'rau muống',
        estimatedGrams: 80,
        cookingMethod: 'luộc',
        userFacingUnit: null,
      },
    ];

    const dbCallQueries: string[] = [];
    const mockDb = {
      execute: vi.fn().mockImplementation(async (query: unknown) => {
        const queryStr = extractSqlText(query);
        if (
          queryStr.includes('ingredient_query_embeddings') ||
          queryStr.includes('synonym_candidates')
        ) {
          return [];
        }
        // Warm-up: embedding cache loading from food_composition
        if (
          queryStr.includes('vietnamese_food_composition') &&
          queryStr.includes('source_id') &&
          queryStr.includes('embedding')
        ) {
          return [];
        }
        // Warm-up: nutrition cache loading (source_id filter, no id IN clause)
        if (
          queryStr.includes('vietnamese_food_composition') &&
          queryStr.includes('source_id') &&
          !queryStr.includes('match_ingredients')
        ) {
          return [];
        }
        dbCallQueries.push(queryStr);

        // Source-aware vector: return match for FAO, empty for USDA.
        // Routing uses queryStr.includes('1') which detects the digit '1'
        // in the embedded vector JSON (e.g. Array(768).fill(0.1) contains '1').
        // This is intentional — see createSourceAwareMockDb in test-helpers.ts.
        if (
          queryStr.includes('match_ingredients_by_source') &&
          !queryStr.includes('fuzzy')
        ) {
          if (queryStr.includes('1')) {
            return [
              {
                ...sampleFuzzyResult,
                id: 'rice-001',
                name_primary: 'Gạo tẻ',
                similarity: 0.85,
              },
            ];
          }
          return []; // USDA: empty
        }
        // Fuzzy fallback: empty (not needed)
        if (queryStr.includes('fuzzy_match_ingredients_by_source')) {
          return [];
        }
        // Batch nutrition query (id IN (...))
        if (queryStr.includes('vietnamese_food_composition')) {
          return [
            { ...sampleNutritionRow, id: 'rice-001', calories_kcal: '352' },
          ];
        }
        return [];
      }),
    };

    const result = await matchIngredients(
      ingredients,
      'cơm thịt bò xào rau muống',
      mockDb as any,
      mockGemini
    );

    // All 3 match the same FAO entry (static mock returns same data)
    expect(result.matched).toHaveLength(3);
    expect(result.unmatched).toHaveLength(0);

    // Verify batch nutrition was fetched (only 1 nutrition query for all matched IDs)
    const nutritionQueries = dbCallQueries.filter(
      (q) =>
        q.includes('vietnamese_food_composition') &&
        !q.includes('match_ingredients') &&
        !q.includes('fuzzy_match')
    );
    expect(nutritionQueries).toHaveLength(1); // exactly 1 batch query
  });
});

describe('rerankCandidates', () => {
  const makeCand = (name: string, sim: number) => ({
    id: `id-${name}`,
    name_primary: name,
    name_alt: null,
    name_en: '',
    state: 'raw',
    similarity: sim,
  });

  it('returns candidates sorted by similarity descending', () => {
    const candidates = [
      makeCand('Quả trứng gà', 0.8),
      makeCand('Trứng gà', 0.78),
      makeCand('Trứng vịt', 0.72),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Quả trứng gà');
    expect(result[0].similarity).toBeCloseTo(0.8);
    expect(result[1].name_primary).toBe('Trứng gà');
    expect(result[2].name_primary).toBe('Trứng vịt');
  });

  it('preserves original similarity scores unchanged', () => {
    const candidates = [
      makeCand('Quả trứng gà', 0.8),
      makeCand('Trứng gà', 0.78),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].similarity).toBeCloseTo(0.8);
    expect(result[1].similarity).toBeCloseTo(0.78);
  });

  it('sorts correctly without modifying scores', () => {
    const candidates = [
      makeCand('Bột gạo nếp', 0.82),
      makeCand('Gạo nếp cái', 0.78),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Bột gạo nếp');
    expect(result[0].similarity).toBeCloseTo(0.82);
    expect(result[1].similarity).toBeCloseTo(0.78);
  });

  it('returns higher-similarity candidate first regardless of name', () => {
    const candidates = [
      makeCand('Bánh đậu xanh', 0.83),
      makeCand('Đậu xanh (đậu tắt)', 0.75),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Bánh đậu xanh');
    expect(result[0].similarity).toBeCloseTo(0.83);
    expect(result[1].similarity).toBeCloseTo(0.75);
  });

  it('returns single candidate unchanged', () => {
    const candidates = [makeCand('Thịt bò', 0.8)];
    const result = rerankCandidates(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.8);
  });

  it('returns empty array unchanged', () => {
    const result = rerankCandidates([]);
    expect(result).toHaveLength(0);
  });

  it('sorts multiple candidates by similarity', () => {
    const candidates = [
      makeCand('Thịt bò', 0.75),
      makeCand('Thịt bò viên', 0.78),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Thịt bò viên');
    expect(result[0].similarity).toBeCloseTo(0.78);
  });
});
