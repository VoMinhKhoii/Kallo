import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import type { MatchConfidence, MatchSource, MatchType } from '../types';

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
export interface MatchInfo {
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  /** Which strategy produced the winning row (vector vs fuzzy). */
  matchType?: MatchType;
  /** Which composition DB the winning row came from. */
  source?: MatchSource;
  /** Wall-clock time for the winning match attempt (DB roundtrips only). */
  latencyMs?: number;
  /** Set by the cascade when an alias-fallback rescued the original name. */
  viaAlias?: boolean;
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
 */
export function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number,
  source?: MatchSource,
  matchType?: MatchType
): MatchInfo | null {
  if (rows.length === 0) return null;

  const reranked = rerankCandidates(rows);
  const topMatch = reranked[0];
  if (topMatch.similarity < minSimilarity) return null;

  return {
    ingredientName,
    foodCompositionId: topMatch.id,
    matchedName: topMatch.name_primary,
    similarity: topMatch.similarity,
    confidence: classifyConfidence(topMatch.similarity),
    ...(source !== undefined ? { source } : {}),
    ...(matchType !== undefined ? { matchType } : {}),
  };
}

/**
 * Pick the best match between FAO and USDA candidates.
 *
 * Pick whichever source has the higher similarity. Thresholds already encode
 * the FAO vs USDA quality bar (FAO: 0.8, USDA: 0.7), so a passing FAO match
 * implies higher confidence than an equivalent USDA score.
 */
export function pickBestSource(
  fao: MatchInfo | null,
  usda: MatchInfo | null
): MatchInfo | null {
  if (fao && !usda) return fao;
  if (!fao && usda) return usda;
  if (!fao && !usda) return null;

  // Both matched — pick the higher scorer
  // (thresholds already encode the FAO vs USDA quality bar)
  return fao!.similarity >= usda!.similarity ? fao : usda;
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
  db: AppDb
): Promise<MatchInfo | null> {
  const t0 = Date.now();
  // Step 1: Source-aware vector search — query FAO and USDA separately
  const [faoVectorRows, usdaVectorRows] = await Promise.all([
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${JSON.stringify(embedding)}::vector, ${SOURCE_FAO}, 3, 0.5)`
    ),
    db.execute(
      sql`SELECT * FROM match_ingredients_by_source(${JSON.stringify(embedding)}::vector, ${SOURCE_USDA}, 3, 0.5)`
    ),
  ]);

  const faoResult = buildMatchResult(
    ingredientName,
    faoVectorRows as unknown as FuzzyMatchRow[],
    FAO_VECTOR_THRESHOLD,
    'fao',
    'vector'
  );
  const usdaResult = buildMatchResult(
    ingredientName,
    usdaVectorRows as unknown as FuzzyMatchRow[],
    USDA_VECTOR_THRESHOLD,
    'usda',
    'vector'
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

  const vectorWinner = pickBestSource(faoResult, usdaResult);
  if (vectorWinner) {
    return { ...vectorWinner, latencyMs: Date.now() - t0 };
  }

  // Step 2: Fuzzy fallback — source-aware
  const [faoFuzzyRows, usdaFuzzyRows] = await Promise.all([
    db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_FAO}, 3, 0.15)`
    ),
    db.execute(
      sql`SELECT * FROM fuzzy_match_ingredients_by_source(${ingredientName}, ${SOURCE_USDA}, 3, 0.15)`
    ),
  ]);

  const faoFuzzy = buildMatchResult(
    ingredientName,
    faoFuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD,
    'fao',
    'fuzzy'
  );
  const usdaFuzzy = buildMatchResult(
    ingredientName,
    usdaFuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_FALLBACK_THRESHOLD,
    'usda',
    'fuzzy'
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

  const fuzzyWinner = pickBestSource(faoFuzzy, usdaFuzzy);
  if (!fuzzyWinner) {
    console.info(`[matching] "${ingredientName}" → unmatched`);
    return null;
  }
  return { ...fuzzyWinner, latencyMs: Date.now() - t0 };
}
