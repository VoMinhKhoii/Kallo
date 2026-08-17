import { sql } from 'drizzle-orm';
import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/cache/embedding-cache';
import {
  createGeminiClient,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { db } from '@/lib/infra/db';
import { type IngredientSearchRow, toSearchResult } from './search-rows';

// Vector matches below this cosine similarity are noise for a picker UI.
const SEMANTIC_VECTOR_THRESHOLD = 0.72;
// Don't embed 1-character queries — the vector is noise at that length.
const MIN_SEMANTIC_QUERY_LENGTH = 2;

/** Resolve a query embedding through the pipeline's 3-tier cache (memory →
 *  ingredient_query_embeddings → live Gemini embed call, cached on return). */
async function resolveEmbedding(q: string): Promise<number[] | null> {
  const cached = await resolveQueryEmbedding(q, db);
  if (cached) return cached;
  const gemini = createGeminiClient(resolveGeminiProvider());
  const [generated] = await gemini.generateEmbeddingBatch([q]);
  if (!generated) return null;
  cacheQueryEmbedding(q, generated, db);
  return generated;
}

/** Semantic supplement, reusing the AI pipeline's deterministic retrieval
 *  layer (cached embeddings + pgvector match_ingredients — NOT its LLM calls).
 *  Covers vocabulary the lexical index can't ("lườn gà" → chicken breast with
 *  zero shared trigrams). Strictly thresholded, and results are flagged so the
 *  UI can label them as related rather than exact. Any failure (no embedding
 *  provider, vector infra down) degrades to lexical-only — never a 500. */
export async function semanticSupplement(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  if (q.length < MIN_SEMANTIC_QUERY_LENGTH) return [];
  try {
    const embedding = await resolveEmbedding(q);
    if (!embedding) return [];
    const rows = await db.execute<IngredientSearchRow>(sql`
      SELECT f.id, f.name_primary, f.name_alt, f.name_en, f.state, f.similarity,
             v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
      FROM match_ingredients(${JSON.stringify(embedding)}::vector, ${limit}, ${SEMANTIC_VECTOR_THRESHOLD}) f
      JOIN vietnamese_food_composition v ON v.id = f.id
      ORDER BY f.similarity DESC, v.source_id ASC
    `);
    return rows.map((row) => ({
      ...toSearchResult(row),
      semantic: true,
    }));
  } catch (error) {
    console.warn(
      '[ingredient-search] semantic supplement failed; lexical results only:',
      error
    );
    return [];
  }
}
