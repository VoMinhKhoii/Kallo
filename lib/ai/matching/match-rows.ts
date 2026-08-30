import type {
  FuzzyMatchRow,
  SourcedMatchRow,
} from '@/lib/ai/matching/match-constants';

/**
 * The raw-SQL boundary of the matcher.
 *
 * `db.execute(sql`…`)` is typed `unknown`, but every candidate result set the
 * matcher reads comes from one of four Postgres functions that declare the
 * SAME row shape:
 *
 *   match_ingredients_by_source / fuzzy_match_ingredients_by_source
 *     — supabase/migrations/20260412143500_add_source_aware_match_functions.sql
 *   match_ingredients_all_sources / fuzzy_match_ingredients_all_sources
 *     — supabase/migrations/20260612181500_pipeline_matching_all_sources.sql
 *     — supabase/migrations/20260812062644_fuzzy_search_best_field_ranking.sql
 *     — supabase/migrations/20260830090000_fuzzy_symmetric_tiebreak.sql
 *
 *   RETURNS TABLE (
 *     id text, name_primary text, name_alt text[], name_en text,
 *     state text, source_id int, similarity float
 *   )
 *
 * `name_alt`, `name_en` and `state` are nullable columns returned verbatim, so
 * the reader below normalizes the two the ranking code types as `string`
 * (`name_en`, `state`) to `''`. Both consumers already treat empty and null
 * alike — `candidateIdentityText` filters falsy names out and `normalizeState`
 * maps anything that is not 'raw'/'cooked' to 'unknown' — so this is a type
 * narrowing, not a behavior change.
 *
 * Rows are mapped 1:1: nothing is dropped, reordered or re-scored here.
 */
function readMatchRow(row: Record<string, unknown>): SourcedMatchRow {
  return {
    id: row.id as string,
    name_primary: (row.name_primary ?? '') as string,
    name_alt: (row.name_alt ?? null) as string[] | null,
    name_en: (row.name_en ?? '') as string,
    state: (row.state ?? '') as string,
    source_id: row.source_id as number,
    similarity: Number(row.similarity),
  };
}

/**
 * Read a result set from one of the `*_all_sources` functions, whose rows carry
 * the `source_id` the caller demuxes on via `splitBySource`.
 */
export function parseSourcedMatchRows(result: unknown): SourcedMatchRow[] {
  if (!Array.isArray(result)) return [];
  return result.map((row) => readMatchRow(row as Record<string, unknown>));
}

/**
 * Read a result set from one of the `*_by_source` functions. Those rows also
 * carry `source_id`, but the caller already knows the source it queried and
 * only reads the candidate fields.
 */
export function parseMatchRows(result: unknown): FuzzyMatchRow[] {
  return parseSourcedMatchRows(result);
}
