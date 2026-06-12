import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import type { MatchConfidence, MatchSource, MatchType } from '../types';
import { captureRrfCandidates, type RrfMeasurement } from './rrf-measurement';
import { shouldSampleForRrf } from './rrf-sampling';

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

/**
 * Effective-similarity penalty applied to candidates whose state doesn't match
 * the ingredient's `expectedState`. Pushes barely-above-threshold cross-state
 * matches (e.g., "Bún tươi" cooked at 0.709 vs USDA "Noodles, japanese, somen,
 * dry" raw) below the acceptance bar so they fall through to the unmatched
 * path instead of corrupting downstream macros with the wrong state's per-100g
 * values. Only applies when both `expectedState` and the candidate state are
 * known (not 'unknown').
 */
export const STATE_MISMATCH_PENALTY = 0.05;

/** Legacy: kept for backward compat in tests */
export const FUZZY_SIMILARITY_THRESHOLD = 0.4;
export const VECTOR_SIMILARITY_THRESHOLD = 0.7;

export function classifyConfidence(similarity: number): MatchConfidence {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

/** Row from the *_all_sources match functions: FuzzyMatchRow + source_id. */
export type SourcedMatchRow = FuzzyMatchRow & { source_id: number };

/** Demux an *_all_sources result set back into per-source candidate lists. */
export function splitBySource(rows: SourcedMatchRow[]): {
  fao: FuzzyMatchRow[];
  usda: FuzzyMatchRow[];
} {
  const fao: FuzzyMatchRow[] = [];
  const usda: FuzzyMatchRow[] = [];
  for (const row of rows) {
    if (row.source_id === SOURCE_FAO) fao.push(row);
    else if (row.source_id === SOURCE_USDA) usda.push(row);
  }
  return { fao, usda };
}

/**
 * Lightweight match result carrying only match metadata (no nutrition).
 * Used internally to decouple matching from nutrition fetching.
 */
export type DbIngredientState = 'raw' | 'cooked' | 'unknown';

function normalizeState(raw: string | null | undefined): DbIngredientState {
  if (raw === 'raw' || raw === 'cooked') return raw;
  return 'unknown';
}

export interface MatchInfo {
  /** Run-scoped compact ingredient ID (§0.1). Set by cascade.ts when known. */
  ingredientId?: string;
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  state: DbIngredientState;
  /** Which strategy produced the winning row (vector vs fuzzy). */
  matchType?: MatchType;
  /** Which composition DB the winning row came from. */
  source?: MatchSource;
  /** Wall-clock time for the winning match attempt (DB roundtrips only). */
  latencyMs?: number;
  /** Set by the cascade when an alias-fallback rescued the original name. */
  viaAlias?: boolean;
}

export interface PickBestSourceContext {
  /** 'unknown' disables the state tie-breaker and falls back to similarity. */
  expectedState: DbIngredientState;
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
 *
 * When `expectedState` is supplied, each candidate's effective threshold is
 * `minSimilarity + STATE_MISMATCH_PENALTY` if its state differs from
 * `expectedState` (both known, i.e. not 'unknown'). We scan the reranked list
 * and accept the first candidate clearing its own threshold — so a marginal
 * cross-state top candidate doesn't shadow a same-state runner-up that would
 * otherwise be a valid match.
 */
export function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number,
  source?: MatchSource,
  matchType?: MatchType,
  expectedState?: DbIngredientState
): MatchInfo | null {
  if (rows.length === 0) return null;

  const reranked = rerankCandidates(rows);
  const accepted = reranked.find((candidate) => {
    const candidateState = normalizeState(candidate.state);
    const stateMismatch =
      expectedState !== undefined &&
      expectedState !== 'unknown' &&
      candidateState !== 'unknown' &&
      candidateState !== expectedState;
    const effectiveMin =
      minSimilarity + (stateMismatch ? STATE_MISMATCH_PENALTY : 0);
    return candidate.similarity >= effectiveMin;
  });
  if (!accepted) return null;
  const acceptedState = normalizeState(accepted.state);

  return {
    ingredientName,
    foodCompositionId: accepted.id,
    matchedName: accepted.name_primary,
    similarity: accepted.similarity,
    confidence: classifyConfidence(accepted.similarity),
    state: acceptedState,
    ...(source !== undefined ? { source } : {}),
    ...(matchType !== undefined ? { matchType } : {}),
  };
}

/**
 * Build up to `k` top MatchInfo candidates from a single source's raw rows.
 * Applies the same state-mismatch threshold logic as `buildMatchResult` but
 * returns ALL passing candidates (sorted by similarity desc), not just the
 * first one.
 *
 * V2 pipeline use: feed both FAO and USDA top-K candidates to Call 2 so the
 * LLM can pick the right one via CRAG-style judgment instead of relying on
 * the server's similarity tie-break.
 */
export function buildMatchTopK(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  k: number,
  minSimilarity: number,
  source?: MatchSource,
  matchType?: MatchType,
  expectedState?: DbIngredientState
): MatchInfo[] {
  if (rows.length === 0 || k <= 0) return [];

  const reranked = rerankCandidates(rows);
  const accepted: MatchInfo[] = [];
  for (const candidate of reranked) {
    if (accepted.length >= k) break;
    const candidateState = normalizeState(candidate.state);
    const stateMismatch =
      expectedState !== undefined &&
      expectedState !== 'unknown' &&
      candidateState !== 'unknown' &&
      candidateState !== expectedState;
    const effectiveMin =
      minSimilarity + (stateMismatch ? STATE_MISMATCH_PENALTY : 0);
    if (candidate.similarity < effectiveMin) continue;
    accepted.push({
      ingredientName,
      foodCompositionId: candidate.id,
      matchedName: candidate.name_primary,
      similarity: candidate.similarity,
      confidence: classifyConfidence(candidate.similarity),
      state: candidateState,
      ...(source !== undefined ? { source } : {}),
      ...(matchType !== undefined ? { matchType } : {}),
    });
  }
  return accepted;
}

/**
 * Merge top-K results from multiple sources into one similarity-desc list,
 * capped at `k`. Stable order on ties (FAO before USDA when similarity
 * matches, mirroring the v1 tie-break preference for curated VN data).
 */
export function mergeTopKAcrossSources(
  perSource: Array<MatchInfo[]>,
  k: number
): MatchInfo[] {
  if (k <= 0) return [];
  const merged: MatchInfo[] = [];
  for (const list of perSource) {
    for (const m of list) merged.push(m);
  }
  merged.sort((a, b) => b.similarity - a.similarity);
  return merged.slice(0, k);
}

/** Standard RRF dampening constant (Cormack et al.) — rank 0 contributes
 *  1/61, rank 1 contributes 1/62, ... */
export const RRF_K = 60;

/**
 * Reciprocal Rank Fusion of the vector and fuzzy candidate lists.
 *
 * Cosine similarity and trigram word-similarity live on incomparable scales,
 * so candidates are fused by RANK within each (already threshold-gated) arm:
 * score(id) = Σ 1/(RRF_K + rank). A candidate both arms agree on outranks a
 * candidate only one arm found — which is exactly the signal that separates
 * "semantically adjacent but wrong" vector hits from real matches. When an id
 * appears in both arms, the variant from the arm where it ranks better is
 * kept (tie → vector, whose similarity feeds confidence classification).
 *
 * Each arm's per-source acceptance thresholds (and the state-mismatch
 * penalty) have already been applied by buildMatchTopK, so fusion can only
 * reorder/extend the candidate pool with rows that individually cleared
 * their own quality bar.
 */
export function rrfFuseCandidates(
  vectorList: MatchInfo[],
  fuzzyList: MatchInfo[],
  k: number
): MatchInfo[] {
  if (k <= 0) return [];
  if (vectorList.length === 0) return fuzzyList.slice(0, k);
  if (fuzzyList.length === 0) return vectorList.slice(0, k);

  const fused = new Map<
    string,
    { score: number; bestRank: number; candidate: MatchInfo }
  >();
  const addArm = (list: MatchInfo[]) => {
    list.forEach((candidate, rank) => {
      const id = candidate.foodCompositionId;
      const contribution = 1 / (RRF_K + rank);
      const existing = fused.get(id);
      if (!existing) {
        fused.set(id, { score: contribution, bestRank: rank, candidate });
        return;
      }
      existing.score += contribution;
      // Keep the variant from the arm where this id ranks strictly better.
      // The vector arm is added first, so it wins rank ties.
      if (rank < existing.bestRank) {
        existing.bestRank = rank;
        existing.candidate = candidate;
      }
    });
  };
  addArm(vectorList);
  addArm(fuzzyList);

  return Array.from(fused.values())
    .sort(
      (a, b) =>
        b.score - a.score || b.candidate.similarity - a.candidate.similarity
    )
    .slice(0, k)
    .map((entry) => entry.candidate);
}

/**
 * Pick the best match between FAO and USDA candidates.
 *
 * Tie-break order: expected state match first, then similarity. Source
 * preference is intentionally not a tie-breaker.
 */
export function pickBestSource(
  fao: MatchInfo | null,
  usda: MatchInfo | null,
  ctx: PickBestSourceContext
): MatchInfo | null {
  if (fao && !usda) return fao;
  if (!fao && usda) return usda;
  if (!fao && !usda) return null;

  if (ctx.expectedState !== 'unknown') {
    const faoStateMatches = fao!.state === ctx.expectedState;
    const usdaStateMatches = usda!.state === ctx.expectedState;
    if (faoStateMatches && !usdaStateMatches) return fao;
    if (!faoStateMatches && usdaStateMatches) return usda;
  }

  return fao!.similarity >= usda!.similarity ? fao : usda;
}

export interface MatchStateInfo {
  expectedState: 'raw' | 'cooked';
  stateSource: 'explicit' | 'method_lookup' | 'unknown';
}

export interface MatchMeasurementContext {
  requestId?: string;
  rrfMeasurements?: RrfMeasurement[];
}

function buildPickContext(stateInfo: MatchStateInfo): PickBestSourceContext {
  return {
    expectedState:
      stateInfo.stateSource === 'unknown' ? 'unknown' : stateInfo.expectedState,
  };
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
export async function matchSingleIngredientWithEmbedding(
  ingredientName: string,
  embedding: number[],
  db: AppDb,
  stateInfo: MatchStateInfo = {
    expectedState: 'cooked',
    stateSource: 'unknown',
  },
  measurementContext: MatchMeasurementContext = {}
): Promise<MatchInfo | null> {
  const t0 = Date.now();
  const pickCtx = buildPickContext(stateInfo);
  const sampled =
    measurementContext.requestId !== undefined &&
    shouldSampleForRrf(measurementContext.requestId);
  const fuzzyStartedAt = performance.now();
  const fuzzyEarlyPromise = sampled
    ? runFuzzySourceQueries(ingredientName, db).catch((err) => {
        console.warn(
          '[rrf] early fuzzy failed; falling back to lazy fuzzy',
          err
        );
        return null;
      })
    : null;

  // Step 1: Source-aware vector search — query FAO and USDA separately.
  // Stringify the embedding once (~15-20KB of JSON, previously done twice).
  const embeddingLiteral = JSON.stringify(embedding);
  const [faoVectorRows, usdaVectorRows] = await Promise.all([
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${embeddingLiteral}::vector, ${SOURCE_FAO}, 3, 0.5)`
    ),
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${embeddingLiteral}::vector, ${SOURCE_USDA}, 3, 0.5)`
    ),
  ]);

  const matchExpectedState = pickCtx.expectedState;
  const faoResult = buildMatchResult(
    ingredientName,
    faoVectorRows as unknown as FuzzyMatchRow[],
    FAO_VECTOR_THRESHOLD,
    'fao',
    'vector',
    matchExpectedState
  );
  const usdaResult = buildMatchResult(
    ingredientName,
    usdaVectorRows as unknown as FuzzyMatchRow[],
    USDA_VECTOR_THRESHOLD,
    'usda',
    'vector',
    matchExpectedState
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

  const vectorWinner = pickBestSource(faoResult, usdaResult, pickCtx);
  if (vectorWinner) {
    if (sampled && fuzzyEarlyPromise) {
      const earlyRows = await fuzzyEarlyPromise;
      if (earlyRows) {
        pushRrfMeasurement({
          rrfMeasurements: measurementContext.rrfMeasurements,
          ingredientName,
          vectorRowsFao: faoVectorRows as unknown as FuzzyMatchRow[],
          vectorRowsUsda: usdaVectorRows as unknown as FuzzyMatchRow[],
          fuzzyRowsFao: earlyRows[0] as unknown as FuzzyMatchRow[],
          fuzzyRowsUsda: earlyRows[1] as unknown as FuzzyMatchRow[],
          latencyMs: Math.max(0, performance.now() - fuzzyStartedAt),
        });
      }
    }
    return { ...vectorWinner, latencyMs: Date.now() - t0 };
  }

  // Step 2: Fuzzy fallback — source-aware
  let fuzzyRows = sampled && fuzzyEarlyPromise ? await fuzzyEarlyPromise : null;
  if (!fuzzyRows) {
    fuzzyRows = await runFuzzySourceQueries(ingredientName, db);
  }
  const [faoFuzzyRows, usdaFuzzyRows] = fuzzyRows;

  const faoFuzzy = buildMatchResult(
    ingredientName,
    faoFuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD,
    'fao',
    'fuzzy',
    matchExpectedState
  );
  const usdaFuzzy = buildMatchResult(
    ingredientName,
    usdaFuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD,
    'usda',
    'fuzzy',
    matchExpectedState
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

  const fuzzyWinner = pickBestSource(faoFuzzy, usdaFuzzy, pickCtx);
  if (sampled) {
    pushRrfMeasurement({
      rrfMeasurements: measurementContext.rrfMeasurements,
      ingredientName,
      vectorRowsFao: faoVectorRows as unknown as FuzzyMatchRow[],
      vectorRowsUsda: usdaVectorRows as unknown as FuzzyMatchRow[],
      fuzzyRowsFao: faoFuzzyRows as unknown as FuzzyMatchRow[],
      fuzzyRowsUsda: usdaFuzzyRows as unknown as FuzzyMatchRow[],
      latencyMs: 0,
    });
  }
  if (!fuzzyWinner) {
    console.info(`[matching] "${ingredientName}" → unmatched`);
    return null;
  }
  return { ...fuzzyWinner, latencyMs: Date.now() - t0 };
}

function runFuzzySourceQueries(ingredientName: string, db: AppDb) {
  return Promise.all([
    db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_FAO}, 3, 0.15)`
    ),
    db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_USDA}, 3, 0.15)`
    ),
  ]);
}

function pushRrfMeasurement(args: {
  rrfMeasurements: RrfMeasurement[] | undefined;
  ingredientName: string;
  vectorRowsFao: FuzzyMatchRow[];
  vectorRowsUsda: FuzzyMatchRow[];
  fuzzyRowsFao: FuzzyMatchRow[];
  fuzzyRowsUsda: FuzzyMatchRow[];
  latencyMs: number;
}) {
  const captured = captureRrfCandidates({
    vectorRowsFao: args.vectorRowsFao,
    vectorRowsUsda: args.vectorRowsUsda,
    fuzzyRowsFao: args.fuzzyRowsFao,
    fuzzyRowsUsda: args.fuzzyRowsUsda,
    topK: 3,
  });
  args.rrfMeasurements?.push({
    topVectorEqualsTopFuzzy: captured.topVectorEqualsTopFuzzy,
    latencyMs: args.latencyMs,
  });
}
