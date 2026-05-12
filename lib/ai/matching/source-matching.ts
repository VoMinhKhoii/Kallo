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
 * When `expectedState` is supplied AND it differs from the top candidate's
 * state (and both are known, i.e. not 'unknown'), the candidate must clear
 * `minSimilarity + STATE_MISMATCH_PENALTY` instead of just `minSimilarity`.
 * That filters out marginal cross-state matches whose per-100g nutrition is
 * physically wrong for the user's ingredient (cooked vs. dry, etc.).
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
  const topMatch = reranked[0];
  const topState = normalizeState(topMatch.state);
  const stateMismatch =
    expectedState !== undefined &&
    expectedState !== 'unknown' &&
    topState !== 'unknown' &&
    topState !== expectedState;
  const effectiveMin =
    minSimilarity + (stateMismatch ? STATE_MISMATCH_PENALTY : 0);
  if (topMatch.similarity < effectiveMin) return null;

  return {
    ingredientName,
    foodCompositionId: topMatch.id,
    matchedName: topMatch.name_primary,
    similarity: topMatch.similarity,
    confidence: classifyConfidence(topMatch.similarity),
    state: topState,
    ...(source !== undefined ? { source } : {}),
    ...(matchType !== undefined ? { matchType } : {}),
  };
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

  // Step 1: Source-aware vector search — query FAO and USDA separately
  const [faoVectorRows, usdaVectorRows] = await Promise.all([
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${JSON.stringify(embedding)}::vector, ${SOURCE_FAO}, 3, 0.5)`
    ),
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${JSON.stringify(embedding)}::vector, ${SOURCE_USDA}, 3, 0.5)`
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
