import { sql } from 'drizzle-orm';
import {
  type DbIngredientState,
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  type MatchInfo,
  type SourcedMatchRow,
  splitBySource,
  USDA_VECTOR_THRESHOLD,
} from '@/lib/ai/matching/match-constants';
import { parseSourcedMatchRows } from '@/lib/ai/matching/match-rows';
import { sourceLimitForIngredient } from '@/lib/ai/matching/rank/candidate-eligibility';
import {
  buildMatchTopK,
  mergeTopKAcrossSources,
} from '@/lib/ai/matching/rank/candidate-ranking';
import { rrfFuseCandidates } from '@/lib/ai/matching/rank/rrf-fusion';
import type { MatchType } from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/infra/db';

/**
 * Per-source top-K extraction from an *_all_sources result set: applies the
 * per-arm, per-source acceptance thresholds + state penalty, exactly as the
 * inline cascade did before. Fusion only ever sees candidates that cleared
 * their own bar.
 */
function armTopK(
  rows: SourcedMatchRow[],
  matchingName: string,
  k: number,
  matchType: MatchType,
  faoThreshold: number,
  usdaThreshold: number,
  expectedState: DbIngredientState
): MatchInfo[] {
  const bySource = splitBySource(rows);
  return mergeTopKAcrossSources(
    [
      buildMatchTopK(
        matchingName,
        bySource.fao,
        k,
        faoThreshold,
        'fao',
        matchType,
        expectedState
      ),
      buildMatchTopK(
        matchingName,
        bySource.usda,
        k,
        usdaThreshold,
        'usda',
        matchType,
        expectedState
      ),
    ],
    k
  );
}

/** Fuzzy/trigram arm alone — one statement returning both sources. */
async function fuzzyArm(
  matchingName: string,
  db: AppDb,
  sourceLimit: number
): Promise<SourcedMatchRow[]> {
  const effectiveLimit = sourceLimitForIngredient(matchingName, sourceLimit);
  return parseSourcedMatchRows(
    await db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_all_sources(${matchingName}, ${effectiveLimit}, 0.15)`
    )
  );
}

/**
 * Hybrid retrieval for one ingredient that HAS a resolved embedding: the vector
 * and fuzzy arms run as two parallel single-statement queries (each returning
 * the top rows for BOTH sources via a window partition), then RRF-fuse. The
 * fuzzy arm always runs so an exact lexical hit can compete with a
 * semantically-adjacent-but-wrong vector hit.
 *
 * Returns null on empty fusion caller-side tracking; also reports whether the
 * vector arm came up empty (telemetry).
 */
export async function retrieveHybridTopK(args: {
  matchingName: string;
  embedding: number[];
  db: AppDb;
  k: number;
  sourceLimit: number;
  expectedState: DbIngredientState;
}): Promise<{ candidates: MatchInfo[]; vectorArmEmpty: boolean }> {
  const { matchingName, embedding, db, k, sourceLimit, expectedState } = args;
  const embeddingLiteral = JSON.stringify(embedding);
  const effectiveLimit = sourceLimitForIngredient(matchingName, sourceLimit);
  // One arm failing must not discard the other's results: settle both, treat
  // a failed arm as empty, and only reject when BOTH arms failed (a healthy
  // fuzzy arm still yields candidates through a vector outage, and vice versa).
  const [vectorSettled, fuzzySettled] = await Promise.allSettled([
    db.execute(
      sql`SELECT * FROM match_ingredients_all_sources(${embeddingLiteral}::vector, ${effectiveLimit}, 0.5)`
    ),
    fuzzyArm(matchingName, db, sourceLimit),
  ]);
  if (
    vectorSettled.status === 'rejected' &&
    fuzzySettled.status === 'rejected'
  ) {
    throw vectorSettled.reason;
  }
  for (const [arm, settled] of [
    ['vector', vectorSettled],
    ['fuzzy', fuzzySettled],
  ] as const) {
    if (settled.status === 'rejected') {
      console.error(
        `[v2-matching] ${arm} arm failed for "${matchingName}"; continuing with the other arm:`,
        settled.reason
      );
    }
  }
  const vectorRows: SourcedMatchRow[] =
    vectorSettled.status === 'fulfilled'
      ? parseSourcedMatchRows(vectorSettled.value)
      : [];
  const fuzzyRows: SourcedMatchRow[] =
    fuzzySettled.status === 'fulfilled' ? fuzzySettled.value : [];

  const vectorList = armTopK(
    vectorRows,
    matchingName,
    k,
    'vector',
    FAO_VECTOR_THRESHOLD,
    USDA_VECTOR_THRESHOLD,
    expectedState
  );
  const fuzzyList = armTopK(
    fuzzyRows,
    matchingName,
    k,
    'fuzzy',
    FUZZY_FALLBACK_THRESHOLD,
    FUZZY_FALLBACK_THRESHOLD,
    expectedState
  );

  return {
    candidates: rrfFuseCandidates(vectorList, fuzzyList, k),
    vectorArmEmpty: vectorList.length === 0,
  };
}

/**
 * Lexical-only fallback for an ingredient whose embedding could NOT be
 * resolved (Gemini error/timeout). Runs the fuzzy/trigram arm alone rather
 * than returning zero candidates — matching degrades, never blanks out.
 */
export async function retrieveLexicalTopK(args: {
  matchingName: string;
  db: AppDb;
  k: number;
  sourceLimit: number;
  expectedState: DbIngredientState;
}): Promise<MatchInfo[]> {
  const { matchingName, db, k, sourceLimit, expectedState } = args;
  const fuzzyRows = await fuzzyArm(matchingName, db, sourceLimit);
  return armTopK(
    fuzzyRows,
    matchingName,
    k,
    'fuzzy',
    FUZZY_FALLBACK_THRESHOLD,
    FUZZY_FALLBACK_THRESHOLD,
    expectedState
  );
}
