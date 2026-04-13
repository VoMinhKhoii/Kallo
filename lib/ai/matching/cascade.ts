import type { AppDb } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import type {
  DecomposedIngredient,
  MatchedIngredient,
  NutritionPer100g,
  UnmatchedIngredient,
} from '../types';
import { resolveAlias, resolvePreMatchAlias } from './aliases';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';
import { batchFetchNutrition } from './nutrition-batch';
import {
  type MatchInfo,
  matchSingleIngredientWithEmbedding,
} from './source-matching';

// Re-export all constants and types for backward compat (index.ts barrel imports from here)
export {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  FUZZY_SIMILARITY_THRESHOLD,
  rerankCandidates,
  SOURCE_FAO,
  SOURCE_USDA,
  USDA_VECTOR_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from './source-matching';

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
  db: AppDb,
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
