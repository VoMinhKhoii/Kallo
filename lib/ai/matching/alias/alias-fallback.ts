import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/cache/embedding-cache';
import { resolveAlias } from '@/lib/ai/matching/alias/aliases';
import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import { ingredientStateInfo } from '@/lib/ai/matching/retrieve/legacy/pick-best-source';
import {
  type MatchMeasurementContext,
  matchSingleIngredientWithEmbedding,
} from '@/lib/ai/matching/retrieve/legacy/source-matching';
import {
  ingredientCanonicalName,
  ingredientDisplayName as ingredientRawName,
} from '@/lib/ai/pipeline/contracts/ingredient-accessors';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { DecomposedIngredient } from '@/lib/ai/types/decomposition';
import type { UnmatchedIngredient } from '@/lib/ai/types/matching';
import { mapWithConcurrency } from '@/lib/core/async/map-with-concurrency';
import type { AppDb } from '@/lib/infra/db';

/**
 * Phase 3b: alias fallback — retry unmatched ingredients with alias-expanded
 * names. Best-effort: failures log and fall through to unmatched. Pushes
 * rescued matches into `matchInfos` (viaAlias) and the rest into `unmatched`.
 * Returns true iff the fallback executed (regardless of rescue outcome).
 */
export async function runAliasFallback(args: {
  unmatchedWithIndex: { ingredient: DecomposedIngredient; index: number }[];
  matchInfos: MatchInfo[];
  unmatched: UnmatchedIngredient[];
  mealContext: string;
  db: AppDb;
  gemini: GeminiClient;
  matchConcurrency: number;
  measurementContext?: MatchMeasurementContext;
}): Promise<boolean> {
  const {
    unmatchedWithIndex,
    matchInfos,
    unmatched,
    mealContext,
    db,
    gemini,
    matchConcurrency,
    measurementContext,
  } = args;
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
            item.stateInfo,
            measurementContext
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
            viaAlias: true,
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
  return aliasRetries.length > 0;
}
