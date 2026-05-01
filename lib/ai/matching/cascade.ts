import type { GeminiClient } from '@/lib/ai/gemini';
import { resolveAlias, resolvePreMatchAlias } from '@/lib/ai/matching/aliases';
import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/matching/embedding-cache';
import { batchFetchNutrition } from '@/lib/ai/matching/nutrition-batch';
import {
  type MatchInfo,
  type MatchStateInfo,
  matchSingleIngredientWithEmbedding,
} from '@/lib/ai/matching/source-matching';
import type {
  DecomposedIngredient,
  MatchedIngredient,
  NutritionPer100g,
  UnmatchedIngredient,
} from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/utils';

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
const MATCH_CONCURRENCY_DEFAULT = 2;

export interface MatchOptions {
  concurrency?: number;
}

const ingredientRawName = (ing: DecomposedIngredient): string =>
  ing.rawName ?? ing.name ?? ing.canonicalName ?? '';

const ingredientCanonicalName = (ing: DecomposedIngredient): string =>
  ing.canonicalName ?? ing.name ?? ing.rawName ?? '';

const ingredientStateInfo = (ing: DecomposedIngredient): MatchStateInfo => ({
  expectedState: ing.expectedState ?? 'cooked',
  stateSource: ing._stateSource ?? 'unknown',
});

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
  gemini: GeminiClient,
  opts: MatchOptions = {}
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];
  const matchConcurrency = opts.concurrency ?? MATCH_CONCURRENCY_DEFAULT;

  // Pre-step: resolve pre-match aliases to fix known wrong-match cases
  // (e.g., "cá lóc" → "Cá quả" to avoid USDA's Atlantic bass mistranslation).
  // Original names are preserved for display; matching uses the alias name.
  const matchingNames = ingredients.map((ing) => {
    const canonicalName = ingredientCanonicalName(ing);
    const alias = resolvePreMatchAlias(canonicalName);
    if (alias !== canonicalName) {
      console.info(
        `[matching] pre-match alias: "${canonicalName}" → "${alias}"`
      );
    }
    return alias;
  });

  // Phase 1: Resolve embeddings (L1/L2 cache) with bounded concurrency
  const cacheSettled = await mapWithConcurrency(
    matchingNames,
    (name) => resolveQueryEmbedding(name, db),
    matchConcurrency
  );
  const cacheResults = cacheSettled.map((r, i) => {
    if (r.status === 'rejected') {
      console.warn(
        `[matching] cache lookup failed for "${matchingNames[i]}", treating as cold miss:`,
        r.reason
      );
    }
    return r.status === 'fulfilled' ? r.value : null;
  });
  const embeddings: (number[] | null)[] = cacheResults.slice();
  const missIndices: number[] = [];
  for (let i = 0; i < cacheResults.length; i++) {
    if (!cacheResults[i]) missIndices.push(i);
  }

  // Phase 2: Batch embed all L3 misses in a single API call (best-effort)
  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => matchingNames[i]);
    console.info(`[matching] batch embedding ${missNames.length} L3 misses`);
    const batchResults = await gemini.generateEmbeddingBatch(missNames);
    if (batchResults.length !== missNames.length) {
      console.warn(
        `[matching] embedding batch length mismatch: expected ${missNames.length}, got ${batchResults.length}; unaligned entries left unmatched`
      );
    } else {
      for (let j = 0; j < missIndices.length; j++) {
        const embedding = batchResults[j];
        if (!embedding) {
          console.warn(
            `[matching] no embedding returned for "${missNames[j]}", leaving unmatched`
          );
          continue;
        }
        const idx = missIndices[j];
        embeddings[idx] = embedding;
        cacheQueryEmbedding(matchingNames[idx], embedding, db);
      }
    }
  }

  // Phase 3: Match each ingredient that has a resolved embedding
  // Items without an embedding are enqueued as unmatched directly
  const matchItems = matchingNames
    .map((name, i) => ({
      name,
      i,
      embedding: embeddings[i],
      stateInfo: ingredientStateInfo(ingredients[i]),
    }))
    .filter(
      (item): item is typeof item & { embedding: number[] } =>
        item.embedding != null
    );
  const matchSettled = await mapWithConcurrency(
    matchItems,
    (item) =>
      matchSingleIngredientWithEmbedding(
        item.name,
        item.embedding,
        db,
        item.stateInfo
      ),
    matchConcurrency
  );

  // Collect successful MatchInfo results and track initial failures
  const matchInfos: MatchInfo[] = [];
  const unmatchedWithIndex: {
    ingredient: DecomposedIngredient;
    index: number;
  }[] = [];

  // Items with no embedding go directly to unmatched (no API call wasted)
  const matchedEmbeddingIndices = new Set(matchItems.map((item) => item.i));
  for (let i = 0; i < ingredients.length; i++) {
    if (!matchedEmbeddingIndices.has(i)) {
      unmatchedWithIndex.push({ ingredient: ingredients[i], index: i });
    }
  }

  for (let j = 0; j < matchSettled.length; j++) {
    const result = matchSettled[j];
    const { i } = matchItems[j];
    if (result.status === 'fulfilled' && result.value) {
      // Restore original ingredient name (pre-match alias may have changed it)
      matchInfos.push({
        ...result.value,
        ingredientName: ingredientRawName(ingredients[i]),
        ingredientId: ingredients[i].ingredientId,
      });
    } else {
      if (result.status === 'rejected') {
        console.error(
          `[matching] Failed to match "${ingredientRawName(ingredients[i])}":`,
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
      const canonicalName = ingredientCanonicalName(ingredient);
      const aliasName = resolveAlias(canonicalName);
      if (aliasName !== canonicalName) {
        aliasRetries.push({
          original: ingredient,
          originalIndex: index,
          aliasName,
        });
      }
    }

    if (aliasRetries.length > 0) {
      // Alias fallback is best-effort: failures log + fall through to unmatched
      const rescuedIndices = new Set<number>();
      try {
        console.info(
          `[matching] alias fallback: ${aliasRetries.map((r) => `${ingredientCanonicalName(r.original)}→${r.aliasName}`).join(', ')}`
        );
        // Resolve embeddings for alias names with bounded concurrency
        const aliasCacheSettled = await mapWithConcurrency(
          aliasRetries,
          (r) => resolveQueryEmbedding(r.aliasName, db),
          matchConcurrency
        );
        const aliasCacheResults = aliasCacheSettled.map((r, i) => {
          if (r.status === 'rejected') {
            console.warn(
              `[matching] alias cache lookup failed for "${aliasRetries[i].aliasName}", treating as cold miss:`,
              r.reason
            );
          }
          return r.status === 'fulfilled' ? r.value : null;
        });
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
          if (batchResults.length !== missNames.length) {
            console.warn(
              `[matching] alias embedding batch length mismatch: expected ${missNames.length}, got ${batchResults.length}; unresolved aliases remain unmatched`
            );
          } else {
            for (let j = 0; j < aliasMissIndices.length; j++) {
              const embedding = batchResults[j];
              if (!embedding) {
                console.warn(
                  `[matching] alias fallback: no embedding returned for "${missNames[j]}", skipping`
                );
                continue;
              }
              const idx = aliasMissIndices[j];
              aliasEmbeddings[idx] = embedding;
              cacheQueryEmbedding(aliasRetries[idx].aliasName, embedding, db);
            }
          }
        }

        // Match alias names (skip entries still missing an embedding)
        const aliasMatchItems = aliasRetries
          .map((r, i) => ({ r, i, embedding: aliasEmbeddings[i] }))
          .filter(
            (item): item is typeof item & { embedding: number[] } =>
              item.embedding != null
          );
        const aliasResults = await mapWithConcurrency(
          aliasMatchItems.map(({ r, embedding }) => ({
            name: r.aliasName,
            embedding,
            stateInfo: ingredientStateInfo(r.original),
          })),
          (item) =>
            matchSingleIngredientWithEmbedding(
              item.name,
              item.embedding,
              db,
              item.stateInfo
            ),
          matchConcurrency
        );

        // Track which originals were rescued by alias (keyed by input index)
        for (let j = 0; j < aliasResults.length; j++) {
          const result = aliasResults[j];
          const { r: retry } = aliasMatchItems[j];
          if (result.status === 'fulfilled' && result.value) {
            matchInfos.push({
              ...result.value,
              ingredientName: ingredientRawName(retry.original),
              ingredientId: retry.original.ingredientId,
            });
            rescuedIndices.add(retry.originalIndex);
            console.info(
              `[matching] alias rescue: "${ingredientCanonicalName(retry.original)}" → "${retry.aliasName}" matched ${result.value.matchedName}`
            );
          } else if (result.status === 'rejected') {
            console.error(
              `[matching] alias fallback failed for "${ingredientCanonicalName(retry.original)}":`,
              result.reason
            );
          }
        }
      } catch (err) {
        console.warn(
          '[matching] alias fallback aborted; keeping original ingredients unmatched:',
          err
        );
      }

      // Only keep truly unmatched (not rescued by alias)
      for (const { ingredient, index } of unmatchedWithIndex) {
        if (!rescuedIndices.has(index)) {
          unmatched.push({
            ingredientName: ingredientRawName(ingredient),
            mealContext,
          });
        }
      }
    } else {
      // No aliases available — all remain unmatched
      for (const { ingredient } of unmatchedWithIndex) {
        unmatched.push({
          ingredientName: ingredientRawName(ingredient),
          mealContext,
        });
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
      const { state, ingredientId, ...rest } = info;
      matched.push({
        ...rest,
        ingredientId,
        nutritionPer100g: nutrition,
        dbState: state,
      });
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
