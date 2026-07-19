import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import { normalizeIngredientKey } from './embedding-cache';
import {
  classifyConfidence,
  type DbIngredientState,
  type MatchInfo,
  normalizeState,
} from './match-constants';

/**
 * Similarity assigned to an exact name hit. 1.0 by definition — an exact,
 * unambiguous lexical match is the strongest possible signal, and this feeds
 * `classifyConfidence` (→ 'high') so Call 2's CRAG judge sees it ranked first.
 */
const EXACT_MATCH_SIMILARITY = 1;

/**
 * Normalized exact-match lookup against the VN-FCT food DB.
 *
 * Matches `name_primary`, any `name_alt` entry, or `name_en` after the same
 * NFC + lowercase + trim normalization used everywhere else (via
 * `normalizeIngredientKey`), restricted to source_id = 1 (curated VN data).
 *
 * Returns a MatchInfo ONLY when exactly ONE distinct row matches — an ambiguous
 * hit (multiple rows) falls through to the embedding/fuzzy cascade rather than
 * guessing. On DB error returns null (treated as a miss; the cascade proceeds).
 *
 * This is the availability + latency short-circuit for common staples: an exact
 * hit skips the embedding round-trip entirely and can never blank out.
 */
export async function resolveExactMatch(
  matchingName: string,
  db: AppDb,
  _expectedState: DbIngredientState
): Promise<MatchInfo | null> {
  const normalized = normalizeIngredientKey(matchingName);
  if (!normalized) return null;

  try {
    const rows = (await db.execute(
      sql`SELECT id, name_primary, state
          FROM vietnamese_food_composition
          WHERE source_id = 1
            AND (
              lower(name_primary) = ${normalized}
              OR lower(name_en) = ${normalized}
              OR EXISTS (
                SELECT 1 FROM unnest(name_alt) AS alt
                WHERE lower(alt) = ${normalized}
              )
            )
          LIMIT 2`
    )) as unknown as Array<Record<string, unknown>>;

    // Exactly one distinct row → unambiguous. Two+ → ambiguous, defer.
    if (rows.length !== 1) return null;

    const row = rows[0];
    return {
      ingredientName: matchingName,
      foodCompositionId: row.id as string,
      matchedName: row.name_primary as string,
      similarity: EXACT_MATCH_SIMILARITY,
      confidence: classifyConfidence(EXACT_MATCH_SIMILARITY),
      state: normalizeState(row.state as string | null),
      source: 'fao',
      matchType: 'fuzzy',
    };
  } catch (err) {
    console.warn(
      `[v2-matching] exact-match lookup failed for "${normalized}", deferring to cascade:`,
      err
    );
    return null;
  }
}
