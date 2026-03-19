import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { mapWithConcurrency } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import type {
  DecomposedIngredient,
  MatchConfidence,
  MatchedIngredient,
  UnmatchedIngredient,
} from '../types';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';
import { fetchNutritionPer100g } from './nutrition-db';

export const CONFIDENCE_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
} as const;

/** Minimum similarity to accept a fuzzy (pg_trgm) match (legacy primary threshold) */
export const FUZZY_SIMILARITY_THRESHOLD = 0.4;

/** Minimum similarity to accept a vector (pgvector) match */
export const VECTOR_SIMILARITY_THRESHOLD = 0.7;

/** Minimum similarity to accept a fuzzy match when used as fallback after vector miss */
export const FUZZY_FALLBACK_THRESHOLD = 0.7;

export function classifyConfidence(similarity: number): MatchConfidence {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

export interface MatchResult {
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
}

/** Max concurrent DB calls to avoid exhausting PgBouncer pool */
const MATCH_CONCURRENCY = 3;

/**
 * Match a list of decomposed ingredients against the food composition DB.
 *
 * Cascade: match_ingredients (pgvector/semantic) → fuzzy_match_ingredients (pg_trgm) → unmatched.
 * Each ingredient is processed independently with bounded concurrency to avoid
 * exhausting the Supabase PgBouncer connection pool.
 */
export async function matchIngredients(
  ingredients: DecomposedIngredient[],
  mealContext: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];

  const results = await mapWithConcurrency(
    ingredients,
    (ingredient) => matchSingleIngredient(ingredient.name, db, gemini),
    MATCH_CONCURRENCY
  );

  for (let i = 0; i < ingredients.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      matched.push(result.value);
    } else {
      if (result.status === 'rejected') {
        console.error(
          `[matching] Failed to match "${ingredients[i].name}":`,
          result.reason
        );
      }
      unmatched.push({
        ingredientName: ingredients[i].name,
        mealContext,
      });
    }
  }

  return { matched, unmatched };
}

async function matchSingleIngredient(
  ingredientName: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchedIngredient | null> {
  // Tiered embedding lookup: L1 memory → L2 exact (name_vi) → L3 Gemini API
  let embedding = await resolveQueryEmbedding(ingredientName, db);

  if (!embedding) {
    // L3: Gemini API fallback (rare after seed script runs)
    embedding = await gemini.generateEmbedding(ingredientName);
    // Fire-and-forget: persist for future use across restarts/instances
    cacheQueryEmbedding(ingredientName, embedding, db);
  }

  // Step 1: Try vector/semantic search (pgvector) — primary
  const vectorRows = await db.execute(
    sql`SELECT * FROM match_ingredients(${JSON.stringify(embedding)}::vector, 3, 0.5)`
  );
  const vectorTop = (vectorRows as unknown as FuzzyMatchRow[])[0];
  if (vectorTop) {
    console.info(
      `[matching] "${ingredientName}" vector: ${vectorTop.name_primary} (${vectorTop.similarity.toFixed(3)})`
    );
  }
  const vectorResult = await buildMatchResult(
    ingredientName,
    vectorRows as unknown as FuzzyMatchRow[],
    VECTOR_SIMILARITY_THRESHOLD,
    db
  );
  if (vectorResult) return vectorResult;

  // Step 2: Fall back to fuzzy match (pg_trgm) with stricter threshold
  const fuzzyRows = await db.execute(
    sql`SELECT * FROM fuzzy_match_ingredients(${ingredientName}, 3, 0.15)`
  );
  const fuzzyTop = (fuzzyRows as unknown as FuzzyMatchRow[])[0];
  if (fuzzyTop) {
    console.info(
      `[matching] "${ingredientName}" fuzzy fallback: ${fuzzyTop.name_primary} (${fuzzyTop.similarity.toFixed(3)})`
    );
  }
  const fuzzyResult = await buildMatchResult(
    ingredientName,
    fuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD,
    db
  );
  if (!fuzzyResult) {
    console.info(`[matching] "${ingredientName}" → unmatched`);
  }
  return fuzzyResult;
}

/**
 * Boost-only re-ranking of DB candidates.
 *
 * Adjusts similarity scores to prefer entries whose name directly matches
 * the query. No penalties — derived products (Bột, Bánh, Quả, …) are never
 * disadvantaged; they simply don't receive a boost when the query doesn't
 * include their prefix.
 */
/** @internal Exported for testing */
export function rerankCandidates(
  query: string,
  candidates: FuzzyMatchRow[]
): FuzzyMatchRow[] {
  if (candidates.length <= 1) return candidates;

  const q = query.trim().toLowerCase();

  const adjusted = candidates.map((c) => {
    const name = c.name_primary.trim().toLowerCase();
    let boost = 0;

    if (q === name) {
      boost = 0.15; // exact match
    } else if (name.startsWith(q)) {
      boost = 0.1; // name starts with query (e.g. "gạo nếp" → "Gạo nếp cái")
    } else if (q.startsWith(name)) {
      boost = 0.05; // query starts with name
    }

    return { ...c, similarity: c.similarity + boost };
  });

  return adjusted.sort((a, b) => b.similarity - a.similarity);
}

async function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number,
  db: PostgresJsDatabase
): Promise<MatchedIngredient | null> {
  if (rows.length === 0) return null;

  const reranked = rerankCandidates(ingredientName, rows);
  const topMatch = reranked[0];
  if (topMatch.similarity < minSimilarity) return null;

  const nutrition = await fetchNutritionPer100g(topMatch.id, db);
  if (!nutrition) return null;

  return {
    ingredientName,
    foodCompositionId: topMatch.id,
    matchedName: topMatch.name_primary,
    similarity: topMatch.similarity,
    confidence: classifyConfidence(topMatch.similarity),
    nutritionPer100g: nutrition,
  };
}
