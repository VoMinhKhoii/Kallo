import { vi } from 'vitest';
import type { GeminiClient } from '../gemini';
import type { BoundedNutrition, NutritionValues } from '../types';

/**
 * Canonical null-filled NutritionValues matching the VTN FCT 2007 schema.
 * Use this in ALL test files to prevent field name drift.
 */
export const NULL_NUTRITION_VALUES: NutritionValues = {
  caloriesKcal: null,
  proteinG: null,
  carbohydrateG: null,
  fatG: null,
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
};

/** Canonical null-filled BoundedNutrition for tests. */
export const NULL_BOUNDED_NUTRITION: BoundedNutrition = {
  caloriesKcal: null,
  proteinG: null,
  carbohydrateG: null,
  fatG: null,
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
};

/**
 * Create a mock GeminiClient with optional overrides.
 * By default, generateEmbedding returns a 768-dim vector of 0.1s.
 */
export function createMockGemini(
  overrides?: Partial<GeminiClient>
): GeminiClient {
  return {
    generateStructuredOutput: vi.fn(),
    generateStructuredOutputStream: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
    generateEmbeddingBatch: vi
      .fn()
      .mockImplementation((texts: string[]) =>
        Promise.resolve(texts.map(() => Array(768).fill(0.1)))
      ),
    ...overrides,
  };
}

/** Extract raw SQL text from a drizzle-orm sql`` tagged template object */
export function extractSqlText(query: unknown): string {
  if (typeof query === 'string') return query;
  if (query && typeof query === 'object' && 'queryChunks' in query) {
    const chunks = (query as { queryChunks: unknown[] }).queryChunks;
    return chunks
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && 'value' in c) {
          return (c as { value: string[] }).value.join('');
        }
        return '';
      })
      .join('');
  }
  return String(query);
}

/**
 * Create a mock DB that routes responses based on SQL query content.
 * Warm-up (embedding), embedding cache, and synonym candidate queries return [] automatically.
 * Other queries (fuzzy/vector match, nutrition cache) return from the response queue.
 */
export function createRoutingMockDb(responses: unknown[][]) {
  let idx = 0;
  return {
    execute: vi.fn().mockImplementation((query: unknown) => {
      const queryStr = extractSqlText(query);
      if (
        queryStr.includes('ingredient_query_embeddings') ||
        queryStr.includes('synonym_candidates')
      ) {
        return Promise.resolve([]);
      }
      // Warm-up: embedding cache loading from food_composition with source_id filter
      if (
        queryStr.includes('vietnamese_food_composition') &&
        queryStr.includes('source_id') &&
        queryStr.includes('embedding')
      ) {
        return Promise.resolve([]);
      }
      return Promise.resolve(responses[idx++] ?? []);
    }),
  };
}

/**
 * Create a mock DB that routes source-aware matching responses by query pattern.
 * Handles Promise.all (parallel FAO + USDA) by matching on function name and source_id.
 *
 * @param routes - Map of query pattern → response. Patterns are matched against SQL text.
 *   Supported patterns:
 *   - 'fao_vector' → match_ingredients_by_source with source_id=1
 *   - 'usda_vector' → match_ingredients_by_source with source_id=2
 *   - 'fao_fuzzy' → fuzzy_match_ingredients_by_source with source_id=1
 *   - 'usda_fuzzy' → fuzzy_match_ingredients_by_source with source_id=2
 *   - 'nutrition' → vietnamese_food_composition (non-embedding, non-source queries)
 */
export function createSourceAwareMockDb(
  routes: Partial<{
    fao_vector: unknown[];
    usda_vector: unknown[];
    fao_fuzzy: unknown[];
    usda_fuzzy: unknown[];
    nutrition: unknown[];
  }>
) {
  return {
    execute: vi.fn().mockImplementation((query: unknown) => {
      const q = extractSqlText(query);
      if (
        q.includes('ingredient_query_embeddings') ||
        q.includes('synonym_candidates')
      ) {
        return Promise.resolve([]);
      }
      // Warm-up: embedding cache loading
      if (
        q.includes('vietnamese_food_composition') &&
        q.includes('source_id') &&
        q.includes('embedding')
      ) {
        return Promise.resolve([]);
      }
      // Source-aware vector matching
      if (q.includes('match_ingredients_by_source') && !q.includes('fuzzy')) {
        if (q.includes('1')) return Promise.resolve(routes.fao_vector ?? []);
        if (q.includes('2')) return Promise.resolve(routes.usda_vector ?? []);
      }
      // Source-aware fuzzy matching
      if (q.includes('fuzzy_match_ingredients_by_source')) {
        if (q.includes('1')) return Promise.resolve(routes.fao_fuzzy ?? []);
        if (q.includes('2')) return Promise.resolve(routes.usda_fuzzy ?? []);
      }
      // Nutrition batch fetch
      if (q.includes('vietnamese_food_composition')) {
        return Promise.resolve(routes.nutrition ?? []);
      }
      return Promise.resolve([]);
    }),
  };
}
