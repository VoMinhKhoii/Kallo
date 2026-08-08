import type { AppDb } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/utils';
import {
  fetchInediblePctForIds,
  getInedibleCache,
  isNutritionCacheInitialized,
} from '../cache/nutrition-cache';
import type { GeminiClient } from '../gemini';
import { readBooleanEnv } from '../pipeline/config/feature-flags';
import { deriveExpectedState } from '../pipeline/cooking-method-state';
import type { DecomposedIngredientV2 } from '../pipeline/schemas-v2';
import type { NutritionPer100g } from '../types';
import { resolvePreMatchAlias } from './aliases';
import { filterByExplicitState } from './candidate-ranking';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';
import { resolveExactMatch } from './exact-match';
import type { DbIngredientState, MatchInfo } from './match-constants';
import { batchFetchNutrition } from './nutrition-batch';
import { retrieveHybridTopK, retrieveLexicalTopK } from './top-k-retrieval';

/**
 * V2 match result per ingredient — up to `k` candidates (sorted by similarity
 * desc) with their nutrition already attached. The grounded-estimation prompt
 * embeds these in the Call 2 XML so the LLM can run a CRAG judgment.
 */
export interface IngredientV2MatchResult {
  ingredientIndex: number;
  candidates: V2MatchCandidate[];
}

export interface V2MatchCandidate {
  info: MatchInfo;
  nutrition: NutritionPer100g | null;
  inediblePct: number | null;
}

export interface MatchTopKOptions {
  k?: number;
  concurrency?: number;
  /**
   * Per-row hard limit returned by the SQL match functions, per source.
   * Matches v1's stable default of 3; the state-penalty filter rarely empties
   * the top-K in practice, so over-fetch headroom isn't worth the extra cost.
   */
  sourceLimit?: number;
}

export const DEFAULT_K = 3;
export const DEFAULT_MATCH_CONCURRENCY = 4;
const DEFAULT_SOURCE_LIMIT = 3;

/**
 * Coarse implicit-state inference from the v2 decomposition input. The
 * matcher uses this only to apply STATE_MISMATCH_PENALTY; the LLM in Call 2
 * still owns the final state interpretation via CRAG verdict + grams.
 *
 * Routes through the canonical `deriveExpectedState` helper so the raw-method
 * vocabulary stays single-sourced (`COOKING_METHOD_STATE`).
 */
function deriveExpectedStateFromV2(
  ingredient: DecomposedIngredientV2,
  dishCookingMethod: string | null | undefined
): DbIngredientState {
  const weightBasis =
    ingredient.stateHint === 'raw_weight'
      ? 'raw'
      : ingredient.stateHint === 'cooked_weight'
        ? 'as_eaten'
        : undefined;
  const { state, source } = deriveExpectedState({
    explicit: undefined,
    dishMethod: ingredient.cookingMethod ?? dishCookingMethod ?? null,
    weightBasis,
  });
  // Preserve v2's prior "unknown when method is empty" semantics so the
  // STATE_MISMATCH_PENALTY does not fire for genuinely-unknown ingredients.
  return source === 'unknown' ? 'unknown' : state;
}

/** Explicit user-stated weighing basis, or null when the user said nothing. */
function explicitWeighState(
  ingredient: DecomposedIngredientV2
): 'raw' | 'cooked' | null {
  if (ingredient.stateHint === 'raw_weight') return 'raw';
  if (ingredient.stateHint === 'cooked_weight') return 'cooked';
  return null;
}

interface IngredientWithContext {
  ingredient: DecomposedIngredientV2;
  index: number;
  matchingName: string;
  expectedState: DbIngredientState;
  dishCookingMethod: string | null;
}

/**
 * Run the top-K matching cascade for a list of v2-decomposed ingredients.
 *
 * Phases:
 *   1. Embedding resolution (L1/L2/L3 — reuses v1 cache).
 *   2. Hybrid retrieval per ingredient: ONE vector statement + ONE fuzzy
 *      statement (each returning both sources via a window partition), run
 *      in parallel. `buildMatchTopK` applies per-source thresholds + the
 *      state-mismatch penalty per arm.
 *   3. Reciprocal Rank Fusion of the vector and fuzzy arms into the final
 *      top-K candidate pool (rank-based — the two arms' scores are not on
 *      comparable scales). The LLM in Call 2 still makes the final pick.
 *   5. Batch-fetch nutrition for all unique candidate IDs once and attach
 *      `per_100g` + `inediblePct` to each candidate.
 */
export async function matchTopKPerIngredient(
  ingredients: DecomposedIngredientV2[],
  dishCookingMethods: Array<string | null>,
  db: AppDb,
  gemini: GeminiClient,
  options: MatchTopKOptions = {}
): Promise<IngredientV2MatchResult[]> {
  const k = options.k ?? DEFAULT_K;
  const concurrency = options.concurrency ?? DEFAULT_MATCH_CONCURRENCY;
  const sourceLimit = options.sourceLimit ?? DEFAULT_SOURCE_LIMIT;

  if (ingredients.length === 0) return [];

  const t0 = Date.now();
  let vectorArmEmptyCount = 0;
  let exactHitCount = 0;
  let lexicalFallbackCount = 0;

  // Pre-match alias rewrite (gated, mirrors v1 cascade.ts): rewrite known
  // surface forms — incl. the curated exact-alias staples — to a canonical
  // VN-FCT name before any lookup. Original names are preserved for display.
  const preMatchAliasEnabled = readBooleanEnv(
    'PIPELINE_PREMATCH_ALIAS_ENABLED',
    true
  );
  const rewriteName = (name: string): string => {
    if (!preMatchAliasEnabled) return name;
    const alias = resolvePreMatchAlias(name);
    if (alias !== name) {
      console.info(`[v2-matching] pre-match alias: "${name}" → "${alias}"`);
    }
    return alias;
  };

  const ctxs: IngredientWithContext[] = ingredients.map((ing, i) => ({
    ingredient: ing,
    index: i,
    matchingName: rewriteName(ing.canonicalName),
    expectedState: deriveExpectedStateFromV2(ing, dishCookingMethods[i]),
    dishCookingMethod: dishCookingMethods[i] ?? null,
  }));

  // Phase 0: exact/alias-first — a single unambiguous normalized name hit
  // short-circuits the embedding round-trip entirely (availability + latency).
  // Ambiguous or missing → falls through to the embedding/lexical cascade.
  const exactMatchEnabled = readBooleanEnv(
    'PIPELINE_V2_EXACT_MATCH_ENABLED',
    true
  );
  const results: IngredientV2MatchResult[] = ctxs.map((c) => ({
    ingredientIndex: c.index,
    candidates: [],
  }));
  const exactResolved = new Array<boolean>(ctxs.length).fill(false);
  const tPhase0 = Date.now();
  if (exactMatchEnabled) {
    const exactSettled = await mapWithConcurrency(
      ctxs,
      (c) => resolveExactMatch(c.matchingName, db, c.expectedState),
      concurrency
    );
    for (let i = 0; i < exactSettled.length; i++) {
      const r = exactSettled[i];
      if (r.status !== 'fulfilled' || !r.value) continue;
      exactResolved[i] = true;
      exactHitCount++;
      results[i] = {
        ingredientIndex: ctxs[i].index,
        candidates: [{ info: r.value, nutrition: null, inediblePct: null }],
      };
    }
  }
  const phase0Ms = Date.now() - tPhase0;

  // Only ingredients NOT resolved by the exact short-circuit continue.
  const pending = ctxs.filter((_, i) => !exactResolved[i]);

  // Phase 1: resolve embeddings via the existing cache layer.
  const tPhase1 = Date.now();
  const cacheSettled = await mapWithConcurrency(
    pending,
    (c) => resolveQueryEmbedding(c.matchingName, db),
    concurrency
  );
  const phase1Ms = Date.now() - tPhase1;
  const embeddings: (number[] | null)[] = cacheSettled.map((r, i) => {
    if (r.status === 'rejected') {
      console.warn(
        `[v2-matching] cache lookup failed for "${pending[i].matchingName}":`,
        r.reason
      );
      return null;
    }
    return r.value;
  });

  // Phase 2: batch-embed L3 misses (best-effort — a failure/empty here now
  // degrades to the lexical arm in Phase 3 instead of blanking the ingredient).
  const tPhase2 = Date.now();
  const missIndices = embeddings
    .map((e, i) => (e ? -1 : i))
    .filter((i) => i >= 0);
  const l3MissCount = missIndices.length;
  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => pending[i].matchingName);
    console.info(`[v2-matching] batch embedding ${missNames.length} L3 misses`);
    try {
      const batchResults = await gemini.generateEmbeddingBatch(missNames);
      if (batchResults.length !== missNames.length) {
        console.warn(
          `[v2-matching] embedding batch length mismatch: expected ${missNames.length}, got ${batchResults.length}`
        );
      } else {
        for (let j = 0; j < missIndices.length; j++) {
          const embedding = batchResults[j];
          if (!embedding) continue;
          const idx = missIndices[j];
          embeddings[idx] = embedding;
          cacheQueryEmbedding(pending[idx].matchingName, embedding, db);
        }
      }
    } catch (err) {
      // Availability hole plugged: rather than returning zero candidates for
      // the whole batch, leave these embeddings null so Phase 3 runs the
      // lexical (fuzzy/trigram) fallback arm for them.
      console.warn(
        '[v2-matching] embedding batch failed; degrading to lexical fallback:',
        err
      );
    }
  }

  const phase2Ms = Date.now() - tPhase2;

  // Phase 3: per-ingredient top-K cascade with bounded concurrency. Ingredients
  // with a resolved embedding run the hybrid vector+fuzzy retrieval; those
  // without (embedding gen failed) fall back to the lexical arm alone.
  const tPhase3 = Date.now();
  const pendingWithEmbedding = pending.map((c, i) => ({
    c,
    embedding: embeddings[i],
  }));
  const settled = await mapWithConcurrency(
    pendingWithEmbedding,
    async ({ c, embedding }) => {
      if (embedding) {
        const { candidates, vectorArmEmpty } = await retrieveHybridTopK({
          matchingName: c.matchingName,
          embedding,
          db,
          k,
          sourceLimit,
          expectedState: c.expectedState,
        });
        if (vectorArmEmpty) vectorArmEmptyCount++;
        return { ingredientIndex: c.index, candidates, embedded: true };
      }
      // Lexical fallback — never blank out.
      const candidates = await retrieveLexicalTopK({
        matchingName: c.matchingName,
        db,
        k,
        sourceLimit,
        expectedState: c.expectedState,
      });
      return { ingredientIndex: c.index, candidates, embedded: false };
    },
    concurrency
  );
  for (const [taskIdx, r] of settled.entries()) {
    if (r.status === 'rejected') {
      // Both retrieval arms AND the lexical fallback failed (DB-level error).
      // The preinitialized empty candidate list stands — Call 2 sees the
      // ingredient as unmatched — but this must be visible as a failure, not
      // pass silently as an ordinary no-match.
      console.error(
        '[v2-matching] retrieval task failed; ingredient proceeds unmatched:',
        r.reason,
        { taskIdx }
      );
      continue;
    }
    if (!r.value.embedded) lexicalFallbackCount++;
    // When the user SAID which state they weighed in, drop opposite-state
    // candidates (keep-if-any fallback) so the CRAG judge isn't offered a row
    // that forces a lossy dry↔cooked conversion the user already resolved.
    const stateFiltered = filterByExplicitState(
      r.value.candidates,
      explicitWeighState(pendingWithEmbedding[taskIdx].c.ingredient)
    );
    results[r.value.ingredientIndex] = {
      ingredientIndex: r.value.ingredientIndex,
      candidates: stateFiltered.map((info) => ({
        info,
        nutrition: null,
        inediblePct: null,
      })),
    };
  }

  const phase3Ms = Date.now() - tPhase3;

  // Phase 5: batch-fetch nutrition + inedible pct for all unique candidate ids.
  // USDA rows are intentionally not back-filled: `inedible_portion_pct` is
  // VN-FCT–specific and USDA imports leave it NULL, so they stay `null` by
  // design rather than paying a roundtrip that returns nothing.
  const tPhase5 = Date.now();
  const uniqueIds = new Set<string>();
  for (const r of results) {
    for (const c of r.candidates) uniqueIds.add(c.info.foodCompositionId);
  }
  if (uniqueIds.size > 0) {
    const ids = Array.from(uniqueIds);
    // Inedible pct: on a warm cache read the full in-memory map; on cold DON'T
    // block on the full-table load (`getInedibleCache` would) — query only this
    // meal's candidate IDs directly. `batchFetchNutrition` already kicked the
    // background warm, so subsequent requests read the warm map.
    const inediblePromise = isNutritionCacheInitialized()
      ? getInedibleCache(db)
      : fetchInediblePctForIds(ids, db);
    const [nutritionMap, inedibleMap] = await Promise.all([
      batchFetchNutrition(ids, db),
      inediblePromise,
    ]);
    for (const r of results) {
      for (const c of r.candidates) {
        const id = c.info.foodCompositionId;
        const foodData = nutritionMap.get(id);
        c.nutrition = foodData ?? null;
        if (foodData?.foodGroupEn) c.info.foodGroupEn = foodData.foodGroupEn;
        c.inediblePct = inedibleMap.get(id) ?? null;
      }
    }
  }
  const phase5Ms = Date.now() - tPhase5;

  // Gated to keep Cloud Logging ingest cheap in prod — set
  // PIPELINE_V2_LOG_TIMINGS=1 to opt in for production debugging.
  // On in dev/test by default (NODE_ENV !== 'production').
  if (
    process.env.PIPELINE_V2_LOG_TIMINGS === '1' ||
    process.env.NODE_ENV !== 'production'
  ) {
    console.info('[v2-matching] phase timings', {
      ingredients: ingredients.length,
      exactHitCount,
      lexicalFallbackCount,
      l3MissCount,
      vectorArmEmptyCount,
      phase0_exactMatchMs: phase0Ms,
      phase1_cacheLookupMs: phase1Ms,
      phase2_geminiBatchMs: phase2Ms,
      phase3_vectorAndFuzzyMs: phase3Ms,
      phase5_nutritionAndInedibleMs: phase5Ms,
      totalMs: Date.now() - t0,
    });
  }

  return results;
}
