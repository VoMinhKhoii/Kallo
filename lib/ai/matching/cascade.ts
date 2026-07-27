import type { GeminiClient } from '@/lib/ai/gemini';
import { runAliasFallback } from '@/lib/ai/matching/alias-fallback';
import { resolvePreMatchAlias } from '@/lib/ai/matching/aliases';
import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/matching/embedding-cache';
import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import {
  batchFetchNutrition,
  type MatchedFoodData,
} from '@/lib/ai/matching/nutrition-batch';
import {
  ingredientStateInfo,
  type MatchMeasurementContext,
  matchSingleIngredientWithEmbedding,
} from '@/lib/ai/matching/source-matching';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import {
  ingredientCanonicalName,
  ingredientDisplayName as ingredientRawName,
} from '@/lib/ai/pipeline/ingredient-accessors';
import type {
  DecomposedIngredient,
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/utils';

// Re-export all constants and types for backward compat (index.ts barrel imports from here)
export { rerankCandidates } from './candidate-ranking';
export {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  FUZZY_SIMILARITY_THRESHOLD,
  SOURCE_FAO,
  SOURCE_USDA,
  USDA_VECTOR_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from './match-constants';

export interface MatchResult {
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  /** True iff Phase 3b alias-fallback executed (regardless of rescue outcome). */
  aliasFallbackFired?: boolean;
}

/**
 * Max concurrent DB calls during matching cascade (Phase 1 cache resolve,
 * Phase 3 vector/fuzzy match, Phase 3b alias fallback). Bumping above 2
 * collapses sequential per-ingredient round-trips: with N=6 ingredients,
 * concurrency=2 yields 3 rounds vs concurrency=4 yields ~2 rounds, saving
 * ~30 ms per round on a typical pgvector query path. Cap is bounded by the
 * Postgres connection pool (PgBouncer transaction pool size).
 *
 * Phase C5: env-tunable so operators can roll forward without redeploying.
 * Default 4; previous default was 2 (overly conservative for the current pool).
 */
const MATCH_CONCURRENCY_DEFAULT_FALLBACK = 4;
function readMatchConcurrencyDefault(): number {
  const raw = process.env.PIPELINE_MATCH_CONCURRENCY;
  if (!raw) return MATCH_CONCURRENCY_DEFAULT_FALLBACK;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : MATCH_CONCURRENCY_DEFAULT_FALLBACK;
}

export interface MatchOptions {
  concurrency?: number;
  measurementContext?: MatchMeasurementContext;
}

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
  let aliasFallbackFired = false;
  const matchConcurrency = opts.concurrency ?? readMatchConcurrencyDefault();

  // Pre-step: resolve pre-match aliases to fix known wrong-match cases
  // (e.g., "cá lóc" → "Cá quả" to avoid USDA's Atlantic bass mistranslation).
  // Original names are preserved for display; matching uses the alias name.
  // Gated by PIPELINE_PREMATCH_ALIAS_ENABLED so operators can disable a
  // misbehaving alias rewrite without a deploy.
  const preMatchAliasEnabled = readBooleanEnv(
    'PIPELINE_PREMATCH_ALIAS_ENABLED',
    true
  );
  const matchingNames = ingredients.map((ing) => {
    const canonicalName = ingredientCanonicalName(ing);
    if (!preMatchAliasEnabled) return canonicalName;
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
        item.stateInfo,
        opts.measurementContext
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

  // Phase 3b: Alias fallback — retry unmatched ingredients with alias-expanded names.
  // Gated by PIPELINE_ALIAS_FALLBACK_ENABLED so operators can disable the
  // extra Gemini batch + DB lookup if it ever becomes a latency liability.
  const aliasFallbackEnabled = readBooleanEnv(
    'PIPELINE_ALIAS_FALLBACK_ENABLED',
    true
  );
  if (unmatchedWithIndex.length > 0 && !aliasFallbackEnabled) {
    // Flag is off — surface the original unmatched list directly with no
    // alias-rescue attempt.
    for (const { ingredient } of unmatchedWithIndex) {
      unmatched.push({
        ingredientName: ingredientRawName(ingredient),
        mealContext,
      });
    }
  } else if (unmatchedWithIndex.length > 0) {
    aliasFallbackFired = await runAliasFallback({
      unmatchedWithIndex,
      matchInfos,
      unmatched,
      mealContext,
      db,
      gemini,
      matchConcurrency,
      measurementContext: opts.measurementContext,
    });
  }

  // Phase 4: Batch-fetch nutrition for all matched IDs in a single query
  const uniqueIds = [...new Set(matchInfos.map((m) => m.foodCompositionId))];
  let nutritionMap: Map<string, MatchedFoodData>;
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
    const foodData = nutritionMap.get(info.foodCompositionId);
    if (foodData) {
      const { state, ingredientId, ...rest } = info;
      matched.push({
        ...rest,
        ingredientId,
        nutritionPer100g: foodData,
        ...(foodData.foodGroupEn ? { foodGroupEn: foodData.foodGroupEn } : {}),
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

  return { matched, unmatched, aliasFallbackFired };
}
