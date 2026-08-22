import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import { filterByExplicitState } from '@/lib/ai/matching/rank/candidate-ranking';
import { resolveExactMatch } from '@/lib/ai/matching/retrieve/exact-match';
import {
  buildIngredientContexts,
  explicitWeighState,
} from '@/lib/ai/matching/retrieve/top-k-context';
import { resolveTopKEmbeddings } from '@/lib/ai/matching/retrieve/top-k-embeddings';
import { attachCandidateNutrition } from '@/lib/ai/matching/retrieve/top-k-nutrition';
import {
  retrieveHybridTopK,
  retrieveLexicalTopK,
} from '@/lib/ai/matching/retrieve/top-k-retrieval';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import { mapWithConcurrency } from '@/lib/core/async/map-with-concurrency';
import type { AppDb } from '@/lib/infra/db/client';

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
 * Run the top-K matching cascade for a list of v2-decomposed ingredients.
 *
 * Phases:
 *   0. Exact/alias-first short-circuit (`exact-match.ts`).
 *   1-2. Embedding resolution (L1/L2/L3 — reuses v1 cache; `top-k-embeddings.ts`).
 *   3. Hybrid retrieval per ingredient: ONE vector statement + ONE fuzzy
 *      statement (each returning both sources via a window partition), run
 *      in parallel. `buildMatchTopK` applies per-source thresholds + the
 *      state-mismatch penalty per arm, then Reciprocal Rank Fusion merges the
 *      two arms into the final top-K pool (rank-based — the two arms' scores
 *      are not on comparable scales). The LLM in Call 2 still makes the final
 *      pick.
 *   5. Batch-fetch nutrition for all unique candidate IDs once and attach
 *      `per_100g` + `inediblePct` to each candidate (`top-k-nutrition.ts`).
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

  const ctxs = buildIngredientContexts(ingredients, dishCookingMethods);

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

  // Phases 1-2: resolve embeddings (cache, then one batch call for the misses).
  const { embeddings, l3MissCount, phase1Ms, phase2Ms } =
    await resolveTopKEmbeddings(pending, db, gemini, concurrency);

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
  const tPhase5 = Date.now();
  await attachCandidateNutrition(results, db);
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
