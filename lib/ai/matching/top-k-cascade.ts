import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import { mapWithConcurrency } from '@/lib/utils';
import { getInedibleCache } from '../cache/nutrition-cache';
import type { GeminiClient } from '../gemini';
import { deriveExpectedState } from '../pipeline/cooking-method-state';
import type { DecomposedIngredientV2 } from '../pipeline/schemas';
import type { NutritionPer100g } from '../types';
import { cacheQueryEmbedding, resolveQueryEmbedding } from './embedding-cache';
import { batchFetchNutrition } from './nutrition-batch';
import {
  buildMatchTopK,
  type DbIngredientState,
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  type FuzzyMatchRow,
  type MatchInfo,
  mergeTopKAcrossSources,
  SOURCE_FAO,
  SOURCE_USDA,
  USDA_VECTOR_THRESHOLD,
} from './source-matching';

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

const DEFAULT_K = 3;
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
 *   2. Source-aware vector search (FAO + USDA), each returning up to
 *      `sourceLimit` rows. Then `buildMatchTopK` applies the
 *      state-mismatch penalty per source.
 *   3. Merge across sources into a single similarity-desc list, capped at
 *      `k` per ingredient.
 *   4. If empty, fall back to fuzzy (pg_trgm) per source and repeat the merge.
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

  const ctxs: IngredientWithContext[] = ingredients.map((ing, i) => ({
    ingredient: ing,
    index: i,
    matchingName: ing.canonicalName,
    expectedState: deriveExpectedStateFromV2(ing, dishCookingMethods[i]),
    dishCookingMethod: dishCookingMethods[i] ?? null,
  }));

  // Phase 1: resolve embeddings via the existing cache layer.
  const cacheSettled = await mapWithConcurrency(
    ctxs,
    (c) => resolveQueryEmbedding(c.matchingName, db),
    concurrency
  );
  const embeddings: (number[] | null)[] = cacheSettled.map((r, i) => {
    if (r.status === 'rejected') {
      console.warn(
        `[v2-matching] cache lookup failed for "${ctxs[i].matchingName}":`,
        r.reason
      );
      return null;
    }
    return r.value;
  });

  // Phase 2: batch-embed L3 misses.
  const missIndices = embeddings
    .map((e, i) => (e ? -1 : i))
    .filter((i) => i >= 0);
  if (missIndices.length > 0) {
    const missNames = missIndices.map((i) => ctxs[i].matchingName);
    console.info(`[v2-matching] batch embedding ${missNames.length} L3 misses`);
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
        cacheQueryEmbedding(ctxs[idx].matchingName, embedding, db);
      }
    }
  }

  // Phase 3: per-ingredient top-K cascade with bounded concurrency.
  const settled = await mapWithConcurrency(
    ctxs,
    async (c) => {
      const embedding = embeddings[c.index];
      if (!embedding) return { ingredientIndex: c.index, candidates: [] };

      // Vector search: query FAO + USDA in parallel. Stringify the embedding
      // once — it's ~768 floats (~15-20KB) and was previously serialized twice.
      const embeddingLiteral = JSON.stringify(embedding);
      const [faoRows, usdaRows] = await Promise.all([
        db.execute(
          sql`SELECT * FROM match_ingredients_by_source(${embeddingLiteral}::vector, ${SOURCE_FAO}, ${sourceLimit}, 0.5)`
        ),
        db.execute(
          sql`SELECT * FROM match_ingredients_by_source(${embeddingLiteral}::vector, ${SOURCE_USDA}, ${sourceLimit}, 0.5)`
        ),
      ]);

      const faoTop = buildMatchTopK(
        c.matchingName,
        faoRows as unknown as FuzzyMatchRow[],
        k,
        FAO_VECTOR_THRESHOLD,
        'fao',
        'vector',
        c.expectedState
      );
      const usdaTop = buildMatchTopK(
        c.matchingName,
        usdaRows as unknown as FuzzyMatchRow[],
        k,
        USDA_VECTOR_THRESHOLD,
        'usda',
        'vector',
        c.expectedState
      );

      let merged = mergeTopKAcrossSources([faoTop, usdaTop], k);

      if (merged.length === 0) {
        // Fuzzy fallback.
        const [faoFuzzy, usdaFuzzy] = await Promise.all([
          db.execute(
            sql`SELECT * FROM fuzzy_match_ingredients_by_source(${c.matchingName}, ${SOURCE_FAO}, ${sourceLimit}, 0.15)`
          ),
          db.execute(
            sql`SELECT * FROM fuzzy_match_ingredients_by_source(${c.matchingName}, ${SOURCE_USDA}, ${sourceLimit}, 0.15)`
          ),
        ]);
        const faoFTop = buildMatchTopK(
          c.matchingName,
          faoFuzzy as unknown as FuzzyMatchRow[],
          k,
          FUZZY_FALLBACK_THRESHOLD,
          'fao',
          'fuzzy',
          c.expectedState
        );
        const usdaFTop = buildMatchTopK(
          c.matchingName,
          usdaFuzzy as unknown as FuzzyMatchRow[],
          k,
          FUZZY_FALLBACK_THRESHOLD,
          'usda',
          'fuzzy',
          c.expectedState
        );
        merged = mergeTopKAcrossSources([faoFTop, usdaFTop], k);
      }

      return {
        ingredientIndex: c.index,
        candidates: merged.map((info) => ({
          info,
          nutrition: null,
          inediblePct: null,
        })),
      };
    },
    concurrency
  );

  const results: IngredientV2MatchResult[] = settled.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ingredientIndex: i, candidates: [] }
  );

  // Phase 5: batch-fetch nutrition + inedible pct for all unique candidate ids.
  // USDA rows are intentionally not back-filled: `inedible_portion_pct` is
  // VN-FCT–specific and USDA imports leave it NULL, so they stay `null` by
  // design rather than paying a roundtrip that returns nothing.
  const uniqueIds = new Set<string>();
  for (const r of results) {
    for (const c of r.candidates) uniqueIds.add(c.info.foodCompositionId);
  }
  if (uniqueIds.size > 0) {
    const ids = Array.from(uniqueIds);
    const [nutritionMap, inedibleMap] = await Promise.all([
      batchFetchNutrition(ids, db),
      getInedibleCache(db),
    ]);
    for (const r of results) {
      for (const c of r.candidates) {
        const id = c.info.foodCompositionId;
        c.nutrition = nutritionMap.get(id) ?? null;
        c.inediblePct = inedibleMap.get(id) ?? null;
      }
    }
  }

  return results;
}
