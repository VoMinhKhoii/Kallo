import type { GoogleGenAI } from '@google/genai';
import type { WithRetry } from './gemini-retry';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

/**
 * Module-level embedding cache keyed by ingredient name.
 * The same Vietnamese ingredient names recur across all users — cached vectors
 * eliminate redundant API calls that would otherwise exhaust rate limits.
 */
const embeddingCache = new Map<string, number[]>();

/** Visible for testing/diagnostics */
export function getEmbeddingCacheStats() {
  return { size: embeddingCache.size };
}

/** Embedding methods for the Gemini client — module-level cache shared across instances. */
export function createEmbeddingMethods({
  ai,
  withRetry,
}: {
  ai: GoogleGenAI;
  withRetry: WithRetry;
}) {
  return {
    async generateEmbedding(text: string): Promise<number[]> {
      const cached = embeddingCache.get(text);
      if (cached) {
        console.info(`[gemini] embedding cache hit: "${text.slice(0, 30)}"`);
        return cached;
      }

      const embedding = await withRetry(
        async (_attempt) => {
          const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ parts: [{ text }] }],
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
          });

          const emb = result.embeddings?.[0]?.values;
          if (!emb) throw new Error('Gemini returned no embedding');

          return emb;
        },
        { label: `embed("${text.slice(0, 30)}")` }
      );

      embeddingCache.set(text, embedding);
      console.info(
        `[gemini] embedding cache miss: "${text.slice(0, 30)}" (cache size: ${embeddingCache.size})`
      );
      return embedding;
    },

    async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      // Partition into cached vs uncached
      const results: (number[] | null)[] = texts.map(
        (t) => embeddingCache.get(t) ?? null
      );
      const uncachedIndices = results
        .map((r, i) => (r === null ? i : -1))
        .filter((i) => i >= 0);

      if (uncachedIndices.length === 0) {
        console.info(`[gemini] batch embed: all ${texts.length} cached`);
        return results as number[][];
      }

      const uncachedTexts = uncachedIndices.map((i) => texts[i]);
      console.info(
        `[gemini] batch embed: ${uncachedTexts.length} uncached / ${texts.length} total`
      );

      const embeddings = await withRetry(
        async (_attempt) => {
          const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: uncachedTexts,
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
          });

          if (
            !result.embeddings ||
            result.embeddings.length !== uncachedTexts.length
          ) {
            throw new Error(
              `Gemini batch returned ${result.embeddings?.length ?? 0} embeddings for ${uncachedTexts.length} texts`
            );
          }

          return result.embeddings.map((e) => {
            if (!e.values) throw new Error('Gemini returned null embedding');
            return e.values;
          });
        },
        { label: `batch-embed(${uncachedTexts.length})` }
      );

      // Populate cache and fill results
      for (let j = 0; j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        results[idx] = embeddings[j];
        embeddingCache.set(texts[idx], embeddings[j]);
      }

      return results as number[][];
    },
  };
}
