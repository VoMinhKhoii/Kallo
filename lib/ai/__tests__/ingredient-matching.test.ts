import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  createRoutingMockDb,
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
    vi.clearAllMocks();
  });

  it('matches via vector search when similarity is high enough', async () => {
    const mockDb = createRoutingMockDb([
      [{ ...sampleFuzzyResult, similarity: 0.8 }], // vector match
      [sampleNutritionRow], // nutrition fetch
    ]);

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].foodCompositionId).toBe('beef-001');
    expect(result.matched[0].confidence).toBe('high');
    expect(result.matched[0].nutritionPer100g.caloriesKcal).toBe(250);
    expect(result.matched[0].nutritionPer100g.proteinG).toBe(26);
  });

  it('falls back to fuzzy search when vector returns no results', async () => {
    const mockDb = createRoutingMockDb([
      [], // vector match: empty
      [{ ...sampleFuzzyResult, similarity: 0.75 }], // fuzzy match (≥0.7)
      [sampleNutritionRow], // nutrition fetch
    ]);

    const result = await matchIngredients(
      [sampleIngredient],
      'bún bò Huế',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0].confidence).toBe('high');
  });

  it('rejects vector match below threshold and falls through to fuzzy', async () => {
    // 0.5 + 0.15 exact-match boost = 0.65, still below 0.70 threshold
    const lowVector = { ...sampleFuzzyResult, similarity: 0.5 };
    const goodFuzzy = { ...sampleFuzzyResult, similarity: 0.75 }; // above 0.7

    const mockDb = createRoutingMockDb([
      [lowVector], // vector: below threshold after reranking
      [goodFuzzy], // fuzzy: above fallback threshold
      [sampleNutritionRow], // nutrition fetch
    ]);

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

    const mockDb = createRoutingMockDb([
      [lowVector], // vector: below 0.70 after reranking
      [lowFuzzy], // fuzzy: below 0.70 after reranking
    ]);

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
    const mockDb = createRoutingMockDb([
      [], // vector: empty
      [], // fuzzy: empty
    ]);

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

    // Both ingredients go through cache miss → API → vector search
    // Order may interleave due to concurrency, use routing mock
    const mockDb = createRoutingMockDb([
      // gạo: vector match
      [
        {
          ...sampleFuzzyResult,
          id: 'rice-001',
          name_primary: 'Gạo',
          similarity: 0.8,
        },
      ],
      // unknown_food: vector miss
      [],
      // gạo: nutrition fetch
      [{ ...sampleNutritionRow, id: 'rice-001', calories_kcal: '350' }],
      // unknown_food: fuzzy fallback miss
      [],
    ]);

    const result = await matchIngredients(
      ingredients,
      'cơm chiên',
      mockDb as any,
      mockGemini
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].ingredientName).toBe('gạo');
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].ingredientName).toBe('unknown_food');
  });

  it('parses nutrition values from string to number, null stays null', async () => {
    const mockDb = createRoutingMockDb([
      [{ ...sampleFuzzyResult, similarity: 0.8 }], // vector match
      [sampleNutritionRow], // nutrition fetch
    ]);

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

    // Each ingredient: 1 vector call + 1 fuzzy fallback = 2 non-cache DB calls per ingredient
    expect(callOrder).toHaveLength(4);
  });

  it('rejects fuzzy fallback below 0.7 threshold as unmatched', async () => {
    // 0.4 + 0.15 exact-match boost = 0.55, below 0.70
    const lowFuzzy = { ...sampleFuzzyResult, similarity: 0.4 };

    const mockDb = createRoutingMockDb([
      [], // vector: empty
      [lowFuzzy], // fuzzy: below 0.7 after reranking
    ]);

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

  it('boosts exact match (+0.15) over higher-similarity derived product', () => {
    const candidates = [
      makeCand('Quả trứng gà', 0.8),
      makeCand('Trứng gà', 0.78),
      makeCand('Trứng vịt', 0.72),
    ];
    const result = rerankCandidates('trứng gà', candidates);
    expect(result[0].name_primary).toBe('Trứng gà');
    expect(result[0].similarity).toBeCloseTo(0.93); // 0.78 + 0.15
  });

  it('exact match for "quả trứng gà" correctly boosts the fruit entry', () => {
    const candidates = [
      makeCand('Quả trứng gà', 0.8),
      makeCand('Trứng gà', 0.78),
    ];
    const result = rerankCandidates('quả trứng gà', candidates);
    expect(result[0].name_primary).toBe('Quả trứng gà');
    expect(result[0].similarity).toBeCloseTo(0.95); // 0.8 + 0.15
  });

  it('boosts name-starts-with-query (+0.10) for base ingredient', () => {
    const candidates = [
      makeCand('Bột gạo nếp', 0.82),
      makeCand('Gạo nếp cái', 0.78),
    ];
    const result = rerankCandidates('gạo nếp', candidates);
    expect(result[0].name_primary).toBe('Gạo nếp cái');
    expect(result[0].similarity).toBeCloseTo(0.88); // 0.78 + 0.10
  });

  it('does not penalize derived products — only boosts direct matches', () => {
    const candidates = [
      makeCand('Bánh đậu xanh', 0.83),
      makeCand('Đậu xanh (đậu tắt)', 0.75),
    ];
    const result = rerankCandidates('đậu xanh', candidates);
    // Đậu xanh (đậu tắt) starts with "đậu xanh" → +0.10
    expect(result[0].name_primary).toBe('Đậu xanh (đậu tắt)');
    expect(result[0].similarity).toBeCloseTo(0.85);
    // Bánh đậu xanh stays at original (no penalty)
    expect(result[1].similarity).toBeCloseTo(0.83);
  });

  it('returns single candidate unchanged', () => {
    const candidates = [makeCand('Thịt bò', 0.8)];
    const result = rerankCandidates('thịt bò', candidates);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.8);
  });

  it('returns empty array unchanged', () => {
    const result = rerankCandidates('thịt bò', []);
    expect(result).toHaveLength(0);
  });

  it('boosts query-starts-with-name (+0.05)', () => {
    const candidates = [
      makeCand('Thịt bò', 0.75),
      makeCand('Thịt bò viên', 0.78),
    ];
    const result = rerankCandidates('thịt bò tươi', candidates);
    // "Thịt bò" — query starts with name → +0.05
    // "Thịt bò viên" — no match → 0
    expect(result[0].name_primary).toBe('Thịt bò');
    expect(result[0].similarity).toBeCloseTo(0.8);
  });
});
