// TODO: This file is ~471 LOC. Consider splitting into:
//   - source-matching.ts (matchSingleIngredientWithEmbedding, pickBestSource)
//   - nutrition-batch.ts (batchFetchNutrition)
//   - cascade.ts (matchIngredients orchestration, constants, classifyConfidence)
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
import { resolveAlias, resolvePreMatchAlias } from './aliases';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';
import { parseNutritionRow } from './nutrition-db';

export const CONFIDENCE_THRESHOLDS = {
  /** Similarity well above all per-source floors — strong match */
  high: 0.85,
  /** Similarity at or above the lower per-source floor — decent match */
  medium: 0.7,
} as const;

/** Source IDs for food composition databases */
export const SOURCE_FAO = 1;
export const SOURCE_USDA = 2;

/** Minimum similarity to accept a FAO vector match (higher bar for curated VN data) */
export const FAO_VECTOR_THRESHOLD = 0.8;

/** Minimum similarity to accept a USDA vector match */
export const USDA_VECTOR_THRESHOLD = 0.7;

/** Minimum similarity to accept a fuzzy match when used as fallback after vector miss */
export const FUZZY_FALLBACK_THRESHOLD = 0.7;

/** Legacy: kept for backward compat in tests */
export const FUZZY_SIMILARITY_THRESHOLD = 0.4;
export const VECTOR_SIMILARITY_THRESHOLD = 0.7;

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

  // Pre-step: resolve pre-match aliases to fix known wrong-match cases
  // (e.g., "cá lóc" → "Cá quả" to avoid USDA's Atlantic bass mistranslation).
  // Original names are preserved for display; matching uses the alias name.
  const matchingNames = ingredients.map((ing) => {
    const alias = resolvePreMatchAlias(ing.name);
    if (alias !== ing.name) {
      console.info(`[matching] pre-match alias: "${ing.name}" → "${alias}"`);
    }
    return alias;
  });

  // Phase 1: Resolve embeddings (L1/L2 cache) concurrently and collect misses
  const cacheResults = await Promise.all(
    matchingNames.map((name) => resolveQueryEmbedding(name, db))
  );
  const embeddings: (number[] | null)[] = cacheResults.slice();
  const missIndices: number[] = [];
  for (let i = 0; i < cacheResults.length; i++) {
    if (!cacheResults[i]) missIndices.push(i);
  }

  // Phase 2: Batch embed all L3 misses in a single API call
  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => matchingNames[i]);
    console.info(`[matching] batch embedding ${missNames.length} L3 misses`);
    const batchResults = await gemini.generateEmbeddingBatch(missNames);
    for (let j = 0; j < missIndices.length; j++) {
      const idx = missIndices[j];
      embeddings[idx] = batchResults[j];
      cacheQueryEmbedding(matchingNames[idx], batchResults[j], db);
    }
  }

  // Phase 3: Match each ingredient (returns MatchInfo without nutrition)
  const results = await mapWithConcurrency(
    matchingNames.map((name, i) => ({ name, embedding: embeddings[i]! })),
    (item) => matchSingleIngredientWithEmbedding(item.name, item.embedding, db),
    MATCH_CONCURRENCY
  );

  // Collect successful MatchInfo results and track initial failures
  const matchInfos: MatchInfo[] = [];
  const unmatchedWithIndex: {
    ingredient: DecomposedIngredient;
    index: number;
  }[] = [];
  for (let i = 0; i < ingredients.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      // Restore original ingredient name (pre-match alias may have changed it)
      matchInfos.push({ ...result.value, ingredientName: ingredients[i].name });
    } else {
      if (result.status === 'rejected') {
        console.error(
          `[matching] Failed to match "${ingredients[i].name}":`,
          result.reason
        );
      }
      unmatchedWithIndex.push({ ingredient: ingredients[i], index: i });
    }
  }

  // Phase 3b: Alias fallback — retry unmatched ingredients with alias-expanded names
  if (unmatchedWithIndex.length > 0) {
    const aliasRetries: {
      original: DecomposedIngredient;
      originalIndex: number;
      aliasName: string;
    }[] = [];
    for (const { ingredient, index } of unmatchedWithIndex) {
      const aliasName = resolveAlias(ingredient.name);
      if (aliasName !== ingredient.name) {
        aliasRetries.push({
          original: ingredient,
          originalIndex: index,
          aliasName,
        });
      }
    }

    if (aliasRetries.length > 0) {
      console.info(
        `[matching] alias fallback: ${aliasRetries.map((r) => `${r.original.name}→${r.aliasName}`).join(', ')}`
      );
      // Resolve embeddings for alias names
      const aliasCacheResults = await Promise.all(
        aliasRetries.map((r) => resolveQueryEmbedding(r.aliasName, db))
      );
      const aliasEmbeddings: (number[] | null)[] = aliasCacheResults.slice();
      const aliasMissIndices: number[] = [];
      for (let i = 0; i < aliasCacheResults.length; i++) {
        if (!aliasCacheResults[i]) aliasMissIndices.push(i);
      }
      if (aliasMissIndices.length > 0) {
        const missNames = aliasMissIndices.map(
          (i) => aliasRetries[i].aliasName
        );
        const batchResults = await gemini.generateEmbeddingBatch(missNames);
        for (let j = 0; j < aliasMissIndices.length; j++) {
          const idx = aliasMissIndices[j];
          aliasEmbeddings[idx] = batchResults[j];
          cacheQueryEmbedding(aliasRetries[idx].aliasName, batchResults[j], db);
        }
      }

      // Match alias names
      const aliasResults = await mapWithConcurrency(
        aliasRetries.map((r, i) => ({
          name: r.aliasName,
          embedding: aliasEmbeddings[i]!,
        })),
        (item) =>
          matchSingleIngredientWithEmbedding(item.name, item.embedding, db),
        MATCH_CONCURRENCY
      );

      // Track which originals were rescued by alias (keyed by input index)
      const rescuedIndices = new Set<number>();
      for (let i = 0; i < aliasRetries.length; i++) {
        const result = aliasResults[i];
        if (result.status === 'fulfilled' && result.value) {
          // Preserve original ingredient name in the result for display
          matchInfos.push({
            ...result.value,
            ingredientName: aliasRetries[i].original.name,
          });
          rescuedIndices.add(aliasRetries[i].originalIndex);
          console.info(
            `[matching] alias rescue: "${aliasRetries[i].original.name}" → "${aliasRetries[i].aliasName}" matched ${result.value.matchedName}`
          );
        }
      }

      // Only keep truly unmatched (not rescued by alias)
      for (const { ingredient, index } of unmatchedWithIndex) {
        if (!rescuedIndices.has(index)) {
          unmatched.push({ ingredientName: ingredient.name, mealContext });
        }
      }
    } else {
      // No aliases available — all remain unmatched
      for (const { ingredient } of unmatchedWithIndex) {
        unmatched.push({ ingredientName: ingredient.name, mealContext });
      }
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
 *
 * Source-aware cascade:
 * 1. Vector search FAO (source_id=1) with high threshold (curated VN data)
 * 2. Vector search USDA (source_id=2) with standard threshold
 * 3. Compare: take the higher-similarity passing match
 * 4. Fuzzy fallback: same source-aware logic
 */
async function matchSingleIngredientWithEmbedding(
  ingredientName: string,
  embedding: number[],
  db: PostgresJsDatabase<any>
): Promise<MatchInfo | null> {
  // Step 1: Source-aware vector search — query FAO and USDA separately
  const [faoVectorRows, usdaVectorRows] = await Promise.all([
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${JSON.stringify(embedding)}::vector, ${SOURCE_FAO}, 3, 0.5)`
    ),
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${JSON.stringify(embedding)}::vector, ${SOURCE_USDA}, 3, 0.5)`
    ),
  ]);

  const faoResult = buildMatchResult(
    ingredientName,
    faoVectorRows as unknown as FuzzyMatchRow[],
    FAO_VECTOR_THRESHOLD
  );
  const usdaResult = buildMatchResult(
    ingredientName,
    usdaVectorRows as unknown as FuzzyMatchRow[],
    USDA_VECTOR_THRESHOLD
  );

  if (faoResult) {
    console.info(
      `[matching] "${ingredientName}" FAO vector: ${faoResult.matchedName} (${faoResult.similarity.toFixed(3)})`
    );
  }
  if (usdaResult) {
    console.info(
      `[matching] "${ingredientName}" USDA vector: ${usdaResult.matchedName} (${usdaResult.similarity.toFixed(3)})`
    );
  }

  const vectorWinner = pickBestSource(faoResult, usdaResult);
  if (vectorWinner) return vectorWinner;

  // Step 2: Fuzzy fallback — source-aware
  const [faoFuzzyRows, usdaFuzzyRows] = await Promise.all([
    db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_FAO}, 3, 0.15)`
    ),
    db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_USDA}, 3, 0.15)`
    ),
  ]);

  const faoFuzzy = buildMatchResult(
    ingredientName,
    faoFuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD
  );
  const usdaFuzzy = buildMatchResult(
    ingredientName,
    usdaFuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD
  );

  if (faoFuzzy) {
    console.info(
      `[matching] "${ingredientName}" FAO fuzzy: ${faoFuzzy.matchedName} (${faoFuzzy.similarity.toFixed(3)})`
    );
  }
  if (usdaFuzzy) {
    console.info(
      `[matching] "${ingredientName}" USDA fuzzy: ${usdaFuzzy.matchedName} (${usdaFuzzy.similarity.toFixed(3)})`
    );
  }

  const fuzzyWinner = pickBestSource(faoFuzzy, usdaFuzzy);
  if (!fuzzyWinner) {
    console.info(`[matching] "${ingredientName}" → unmatched`);
  }
  return fuzzyWinner;
}

/**
 * Pick the best match between FAO and USDA candidates.
 *
 * Pick whichever source has the higher similarity. Thresholds already encode
 * the FAO vs USDA quality bar (FAO: 0.8, USDA: 0.7), so a passing FAO match
 * implies higher confidence than an equivalent USDA score.
 */
function pickBestSource(
  fao: MatchInfo | null,
  usda: MatchInfo | null
): MatchInfo | null {
  if (fao && !usda) return fao;
  if (!fao && usda) return usda;
  if (!fao && !usda) return null;

  // Both matched — pick the higher scorer
  // (thresholds already encode the FAO vs USDA quality bar)
  return fao!.similarity >= usda!.similarity ? fao : usda;
}

/**
 * Sort DB candidates by similarity descending.
 * The DB already returns results in order, but this ensures consistent
 * ordering when combining candidates from multiple sources.
 */
/** @internal Exported for testing */
export function rerankCandidates(candidates: FuzzyMatchRow[]): FuzzyMatchRow[] {
  if (candidates.length <= 1) return candidates;

  return [...candidates].sort((a, b) => b.similarity - a.similarity);
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

  const reranked = rerankCandidates(rows);
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
