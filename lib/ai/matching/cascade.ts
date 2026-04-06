import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { mapWithConcurrency } from '@/lib/utils';
import { getNutritionCache } from '../cache/nutrition-cache';
import type { GeminiClient } from '../gemini';
import type {
  DecomposedIngredient,
  MatchConfidence,
  MatchedIngredient,
  NutritionPer100g,
  UnmatchedIngredient,
} from '../types';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';
import { parseNutritionRow } from './nutrition-db';

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

/**
 * Lightweight match result carrying only match metadata (no nutrition).
 * Used internally to decouple matching from nutrition fetching.
 */
interface MatchInfo {
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
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
 * Embedding resolution is batched: L1/L2 cache hits are resolved first, then all L3 misses
 * are collected into a single batch Gemini API call before matching proceeds.
 *
 * Nutrition fetching is batched: all matched IDs are collected after matching,
 * then fetched in a single WHERE id = ANY(...) query to avoid N+1 round-trips.
 */
export async function matchIngredients(
  ingredients: DecomposedIngredient[],
  mealContext: string,
  db: PostgresJsDatabase<any>,
  gemini: GeminiClient
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];

  // Phase 1: Resolve embeddings (L1/L2 cache) concurrently and collect misses
  const cacheResults = await Promise.all(
    ingredients.map((ing) => resolveQueryEmbedding(ing.name, db))
  );
  const embeddings: (number[] | null)[] = cacheResults.slice();
  const missIndices: number[] = [];
  for (let i = 0; i < cacheResults.length; i++) {
    if (!cacheResults[i]) missIndices.push(i);
  }

  // Phase 2: Batch embed all L3 misses in a single API call
  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => ingredients[i].name);
    console.info(`[matching] batch embedding ${missNames.length} L3 misses`);
    const batchResults = await gemini.generateEmbeddingBatch(missNames);
    for (let j = 0; j < missIndices.length; j++) {
      const idx = missIndices[j];
      embeddings[idx] = batchResults[j];
      cacheQueryEmbedding(ingredients[idx].name, batchResults[j], db);
    }
  }

  // Phase 3: Match each ingredient (returns MatchInfo without nutrition)
  const results = await mapWithConcurrency(
    ingredients.map((ingredient, i) => ({
      name: ingredient.name,
      embedding: embeddings[i]!,
    })),
    (item) => matchSingleIngredientWithEmbedding(item.name, item.embedding, db),
    MATCH_CONCURRENCY
  );

  // Collect successful MatchInfo results and track failures
  const matchInfos: MatchInfo[] = [];
  for (let i = 0; i < ingredients.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      matchInfos.push(result.value);
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

  // Phase 4: Batch-fetch nutrition for all matched IDs in a single query
  const uniqueIds = [...new Set(matchInfos.map((m) => m.foodCompositionId))];
  let nutritionMap: Map<string, NutritionPer100g>;
  try {
    nutritionMap = await batchFetchNutrition(uniqueIds, db);
  } catch (err) {
    // Single retry for transient DB errors (connection hiccups, timeouts)
    console.warn('[matching] batchFetchNutrition failed, retrying once:', err);
    try {
      nutritionMap = await batchFetchNutrition(uniqueIds, db);
    } catch (retryErr) {
      console.error(
        '[matching] batchFetchNutrition retry also failed:',
        retryErr
      );
      nutritionMap = new Map();
    }
  }

  // Phase 5: Combine MatchInfo + nutrition → MatchedIngredient
  for (const info of matchInfos) {
    const nutrition = nutritionMap.get(info.foodCompositionId);
    if (nutrition) {
      matched.push({ ...info, nutritionPer100g: nutrition });
    } else {
      console.warn(
        `[matching] No nutrition data for matched ID "${info.foodCompositionId}" (${info.ingredientName})`
      );
      unmatched.push({
        ingredientName: info.ingredientName,
        mealContext,
      });
    }
  }

  return { matched, unmatched };
}

/**
 * Batch-fetch nutrition per 100g for a list of food composition IDs.
 *
 * Checks the in-memory nutrition cache first (loaded once per process from
 * all 526 FAO entries). Falls back to a direct DB query only for IDs that
 * are not in the cache (should not happen in practice once warm, but handles
 * cold-start race conditions gracefully).
 */
async function batchFetchNutrition(
  ids: string[],
  db: PostgresJsDatabase<any>
): Promise<Map<string, NutritionPer100g>> {
  const map = new Map<string, NutritionPer100g>();
  if (ids.length === 0) return map;

  const nutritionCache = await getNutritionCache(db);

  const missIds: string[] = [];
  for (const id of ids) {
    const cached = nutritionCache.get(id);
    if (cached) {
      map.set(id, cached);
    } else {
      missIds.push(id);
    }
  }

  if (missIds.length > 0) {
    // Cache miss — query DB directly for uncached IDs and populate cache
    const idList = sql.join(
      missIds.map((id) => sql`${id}`),
      sql`, `
    );
    const rows = await db.execute(
      sql`SELECT * FROM vietnamese_food_composition WHERE id IN (${idList})`
    );
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const id = row.id as string;
      const nutrition = parseNutritionRow(row);
      map.set(id, nutrition);
      nutritionCache.set(id, nutrition);
    }
  }

  return map;
}

/**
 * Match a single ingredient using a pre-resolved embedding.
 * Returns lightweight MatchInfo (no nutrition data).
 * Nutrition is batch-fetched separately in matchIngredients.
 */
async function matchSingleIngredientWithEmbedding(
  ingredientName: string,
  embedding: number[],
  db: PostgresJsDatabase<any>
): Promise<MatchInfo | null> {
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
  const vectorResult = buildMatchResult(
    ingredientName,
    vectorRows as unknown as FuzzyMatchRow[],
    VECTOR_SIMILARITY_THRESHOLD
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
  const fuzzyResult = buildMatchResult(
    ingredientName,
    fuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD
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

/**
 * Build a lightweight MatchInfo from candidate rows.
 * Pure function — no DB calls. Nutrition is fetched separately in batch.
 */
function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number
): MatchInfo | null {
  if (rows.length === 0) return null;

  const reranked = rerankCandidates(ingredientName, rows);
  const topMatch = reranked[0];
  if (topMatch.similarity < minSimilarity) return null;

  return {
    ingredientName,
    foodCompositionId: topMatch.id,
    matchedName: topMatch.name_primary,
    similarity: topMatch.similarity,
    confidence: classifyConfidence(topMatch.similarity),
  };
}
