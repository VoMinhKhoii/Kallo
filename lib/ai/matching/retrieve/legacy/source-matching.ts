import { sql } from 'drizzle-orm';
import {
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  type FuzzyMatchRow,
  type MatchInfo,
  SOURCE_FAO,
  SOURCE_USDA,
  USDA_VECTOR_THRESHOLD,
} from '@/lib/ai/matching/match-constants';
import { parseMatchRows } from '@/lib/ai/matching/match-rows';
import { buildMatchResult } from '@/lib/ai/matching/rank/candidate-ranking';
import {
  pushRrfMeasurement,
  type RrfMeasurement,
} from '@/lib/ai/matching/rank/rrf-measurement';
import { shouldSampleForRrf } from '@/lib/ai/matching/rank/rrf-sampling';
import {
  buildPickContext,
  type MatchStateInfo,
  pickBestSource,
} from '@/lib/ai/matching/retrieve/legacy/pick-best-source';
import type { AppDb } from '@/lib/db';

export interface MatchMeasurementContext {
  requestId?: string;
  rrfMeasurements?: RrfMeasurement[];
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
    db
      .execute(
        sql`SELECT * FROM match_ingredients_by_source(${embeddingLiteral}::vector, ${SOURCE_FAO}, 3, 0.5)`
      )
      .then(parseMatchRows),
    db
      .execute(
        sql`SELECT * FROM match_ingredients_by_source(${embeddingLiteral}::vector, ${SOURCE_USDA}, 3, 0.5)`
      )
      .then(parseMatchRows),
  ]);

  const matchExpectedState = pickCtx.expectedState;
  const faoResult = buildMatchResult(
    ingredientName,
    faoVectorRows,
    FAO_VECTOR_THRESHOLD,
    'fao',
    'vector',
    matchExpectedState
  );
  const usdaResult = buildMatchResult(
    ingredientName,
    usdaVectorRows,
    USDA_VECTOR_THRESHOLD,
    'usda',
    'vector',
    matchExpectedState
  );

  logArmWinner(ingredientName, 'FAO', 'vector', faoResult);
  logArmWinner(ingredientName, 'USDA', 'vector', usdaResult);

  const vectorWinner = pickBestSource(faoResult, usdaResult, pickCtx);
  if (vectorWinner) {
    if (sampled && fuzzyEarlyPromise) {
      const earlyRows = await fuzzyEarlyPromise;
      if (earlyRows) {
        pushRrfMeasurement({
          rrfMeasurements: measurementContext.rrfMeasurements,
          ingredientName,
          vectorRowsFao: faoVectorRows,
          vectorRowsUsda: usdaVectorRows,
          fuzzyRowsFao: earlyRows[0],
          fuzzyRowsUsda: earlyRows[1],
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
    faoFuzzyRows,
    FUZZY_FALLBACK_THRESHOLD,
    'fao',
    'fuzzy',
    matchExpectedState
  );
  const usdaFuzzy = buildMatchResult(
    ingredientName,
    usdaFuzzyRows,
    FUZZY_FALLBACK_THRESHOLD,
    'usda',
    'fuzzy',
    matchExpectedState
  );

  logArmWinner(ingredientName, 'FAO', 'fuzzy', faoFuzzy);
  logArmWinner(ingredientName, 'USDA', 'fuzzy', usdaFuzzy);

  const fuzzyWinner = pickBestSource(faoFuzzy, usdaFuzzy, pickCtx);
  if (sampled) {
    pushRrfMeasurement({
      rrfMeasurements: measurementContext.rrfMeasurements,
      ingredientName,
      vectorRowsFao: faoVectorRows,
      vectorRowsUsda: usdaVectorRows,
      fuzzyRowsFao: faoFuzzyRows,
      fuzzyRowsUsda: usdaFuzzyRows,
      latencyMs: 0,
    });
  }
  if (!fuzzyWinner) {
    console.info(`[matching] "${ingredientName}" → unmatched`);
    return null;
  }
  return { ...fuzzyWinner, latencyMs: Date.now() - t0 };
}

/** Per-arm candidate log line, emitted only when that arm produced a winner. */
function logArmWinner(
  ingredientName: string,
  source: 'FAO' | 'USDA',
  arm: 'vector' | 'fuzzy',
  result: MatchInfo | null
): void {
  if (!result) return;
  console.info(
    `[matching] "${ingredientName}" ${source} ${arm}: ${result.matchedName} (${result.similarity.toFixed(3)})`
  );
}

function runFuzzySourceQueries(
  ingredientName: string,
  db: AppDb
): Promise<[FuzzyMatchRow[], FuzzyMatchRow[]]> {
  return Promise.all([
    db
      .execute(
        sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_FAO}, 3, 0.15)`
      )
      .then(parseMatchRows),
    db
      .execute(
        sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_USDA}, 3, 0.15)`
      )
      .then(parseMatchRows),
  ]);
}
