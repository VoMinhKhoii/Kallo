import type { GoogleGenAI } from '@google/genai';
import {
  getMemoizedEmbedding,
  inFlightEmbedding,
  memoizedEmbeddingCount,
  memoizeEmbedding,
  trackInFlightEmbedding,
} from '@/lib/ai/cache/provider-embedding-memo';
import type { WithRetry } from './retry';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

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
      const cached = getMemoizedEmbedding(text);
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

      memoizeEmbedding(text, embedding);
      console.info(
        `[gemini] embedding cache miss: "${text.slice(0, 30)}" (cache size: ${memoizedEmbeddingCount()})`
      );
      return embedding;
    },

    async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      // Partition into cached vs uncached
      const results: (number[] | null)[] = texts.map(
        (t) => getMemoizedEmbedding(t) ?? null
      );
      const uncachedIndices = results
        .map((r, i) => (r === null ? i : -1))
        .filter((i) => i >= 0);

      if (uncachedIndices.length === 0) {
        console.info(`[gemini] batch embed: all ${texts.length} cached`);
        return results as number[][];
      }

      // Join requests already in flight for the same text; request the rest
      // once each (a batch may repeat a string).
      const pending = new Map<string, Promise<number[]>>();
      for (const i of uncachedIndices) {
        const joined = inFlightEmbedding(texts[i]);
        if (joined) pending.set(texts[i], joined);
      }
      const uncachedTexts = [
        ...new Set(uncachedIndices.map((i) => texts[i])),
      ].filter((t) => !pending.has(t));
      console.info(
        `[gemini] batch embed: ${uncachedTexts.length} uncached, ${pending.size} in flight / ${texts.length} total`
      );

      if (uncachedTexts.length > 0) {
        const batch = withRetry(
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
        uncachedTexts.forEach((text, j) => {
          const one = batch.then((embeddings) => {
            memoizeEmbedding(text, embeddings[j]);
            return embeddings[j];
          });
          trackInFlightEmbedding(text, one);
          pending.set(text, one);
        });
      }

      for (const i of uncachedIndices) {
        results[i] = await (pending.get(texts[i]) as Promise<number[]>);
      }

      return results as number[][];
    },
  };
}
