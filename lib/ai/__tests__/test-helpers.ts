import { vi } from 'vitest';
import type { AppDb } from '@/lib/db';
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
 * @param options.customRouter - Optional function called before default routing.
 *   Return an array to override the response, or null to fall through to default routing.
 *   Use this to provide explicit, deterministic routing instead of relying on SQL text heuristics.
 */
export function createSourceAwareMockDb(
  routes: Partial<{
    fao_vector: unknown[];
    usda_vector: unknown[];
    fao_fuzzy: unknown[];
    usda_fuzzy: unknown[];
    nutrition: unknown[];
    exact: unknown[];
  }>,
  options?: { customRouter?: (q: string) => unknown[] | null }
): AppDb {
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
      // Custom router takes priority over default routing
      if (options?.customRouter) {
        const result = options.customRouter(q);
        if (result !== null) return Promise.resolve(result);
      }
      // Single-statement all-sources matching (v2 hybrid retrieval): combine
      // the per-source routes and tag rows with source_id, the column the
      // *_all_sources functions add so the caller can re-partition.
      const withSource = (rows: unknown[] | undefined, sourceId: number) =>
        (rows ?? []).map((r) => ({ source_id: sourceId, ...(r as object) }));
      if (q.includes('fuzzy_match_ingredients_all_sources')) {
        return Promise.resolve([
          ...withSource(routes.fao_fuzzy, 1),
          ...withSource(routes.usda_fuzzy, 2),
        ]);
      }
      if (q.includes('match_ingredients_all_sources')) {
        return Promise.resolve([
          ...withSource(routes.fao_vector, 1),
          ...withSource(routes.usda_vector, 2),
        ]);
      }
      // Source-aware vector matching (legacy v1 path)
      if (q.includes('match_ingredients_by_source') && !q.includes('fuzzy')) {
        if (q.includes('1')) return Promise.resolve(routes.fao_vector ?? []);
        if (q.includes('2')) return Promise.resolve(routes.usda_vector ?? []);
      }
      // Source-aware fuzzy matching
      if (q.includes('fuzzy_match_ingredients_by_source')) {
        if (q.includes('1')) return Promise.resolve(routes.fao_fuzzy ?? []);
        if (q.includes('2')) return Promise.resolve(routes.usda_fuzzy ?? []);
      }
      // Phase-0 exact-match lookup (v2): SELECTs name_primary and probes
      // name_alt via `unnest`, which the nutrition batch query never does.
      // Route it separately so it doesn't fall through to the nutrition rows
      // (which would masquerade as a bogus single-row exact hit). Defaults to
      // no exact hit so callers exercising the vector/fuzzy arms are unaffected.
      if (
        q.includes('vietnamese_food_composition') &&
        q.includes('unnest(name_alt)')
      ) {
        return Promise.resolve(routes.exact ?? []);
      }
      // Nutrition batch fetch
      if (q.includes('vietnamese_food_composition')) {
        return Promise.resolve(routes.nutrition ?? []);
      }
      return Promise.resolve([]);
    }),
  } as unknown as AppDb;
}
