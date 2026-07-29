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

export function normalizeState(
  raw: string | null | undefined
): DbIngredientState {
  if (raw === 'raw' || raw === 'cooked') return raw;
  return 'unknown';
}

export interface MatchInfo {
  /** Run-scoped compact ingredient ID (§0.1). Set by cascade.ts when known. */
  ingredientId?: string;
  ingredientName: string;
  foodCompositionId: string;
  /** Authoritative DB food-group taxonomy, attached with row metadata. */
  foodGroupEn?: string;
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
