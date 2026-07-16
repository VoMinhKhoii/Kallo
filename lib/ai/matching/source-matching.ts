import { sql } from 'drizzle-orm';
import type { DecomposedIngredient } from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';
import { buildMatchResult } from './candidate-ranking';
import {
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  type FuzzyMatchRow,
  type MatchInfo,
  type PickBestSourceContext,
  SOURCE_FAO,
  SOURCE_USDA,
  USDA_VECTOR_THRESHOLD,
} from './match-constants';
import { captureRrfCandidates, type RrfMeasurement } from './rrf-measurement';
import { shouldSampleForRrf } from './rrf-sampling';

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

export const ingredientStateInfo = (
  ing: DecomposedIngredient
): MatchStateInfo => ({
  expectedState: ing.expectedState ?? 'cooked',
  stateSource: ing._stateSource ?? 'unknown',
});

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
