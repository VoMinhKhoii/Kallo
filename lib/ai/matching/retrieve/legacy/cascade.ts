import { runAliasFallback } from '@/lib/ai/matching/alias/alias-fallback';
import { resolvePreMatchAlias } from '@/lib/ai/matching/alias/aliases';
import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import {
  readMatchConcurrencyDefault,
  resolveMatchEmbeddings,
} from '@/lib/ai/matching/retrieve/legacy/cascade-embeddings';
import { attachNutrition } from '@/lib/ai/matching/retrieve/legacy/cascade-nutrition';
import { ingredientStateInfo } from '@/lib/ai/matching/retrieve/legacy/pick-best-source';
import {
  type MatchMeasurementContext,
  matchSingleIngredientWithEmbedding,
} from '@/lib/ai/matching/retrieve/legacy/source-matching';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import {
  ingredientCanonicalName,
  ingredientDisplayName as ingredientRawName,
} from '@/lib/ai/pipeline/contracts/ingredient-accessors';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { DecomposedIngredient } from '@/lib/ai/types/decomposition';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import { mapWithConcurrency } from '@/lib/async/map-with-concurrency';
import type { AppDb } from '@/lib/db';

export interface MatchResult {
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  /** True iff Phase 3b alias-fallback executed (regardless of rescue outcome). */
  aliasFallbackFired?: boolean;
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

  // Phases 1–2: resolve an embedding per matching name (L1/L2 cache, then one
  // batch call for the L3 misses).
  const embeddings = await resolveMatchEmbeddings(
    matchingNames,
    db,
    gemini,
    matchConcurrency
  );

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

  // Phases 4–5: one batched nutrition query, then MatchInfo + nutrition →
  // MatchedIngredient.
  await attachNutrition({ matchInfos, matched, unmatched, mealContext, db });

  return { matched, unmatched, aliasFallbackFired };
}
