import { vi } from 'vitest';
import type { GeminiClient } from '../gemini';

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
 * Embedding cache and synonym candidate queries return [] automatically.
 * Other queries return the next item from the provided response queue.
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
      return Promise.resolve(responses[idx++] ?? []);
    }),
  };
}
