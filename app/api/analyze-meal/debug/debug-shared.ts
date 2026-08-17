import type { GeminiAttemptMetadata } from '@/lib/ai/provider/provider';

export const DEBUG_LLM_TIMEOUT_MS = 25_000;

/** Extract only the big 4 macros from a nutrition object for debug readability */
export function pickMacros(obj: any) {
  if (!obj) return obj;
  return {
    caloriesKcal: obj.caloriesKcal ?? null,
    proteinG: obj.proteinG ?? null,
    carbohydrateG: obj.carbohydrateG ?? null,
    fatG: obj.fatG ?? null,
  };
}

export function serializeAttempt(metadata: GeminiAttemptMetadata) {
  return {
    attempt: metadata.attempt,
    model: metadata.model,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    error:
      metadata.error instanceof Error
        ? metadata.error.message
        : metadata.error != null
          ? String(metadata.error)
          : null,
  };
}

/**
 * The row both ingredient-search functions the debug route calls declare —
 * `fuzzy_match_ingredients` (supabase/migrations/20260313135804_fix_fuzzy_match_ranking.sql)
 * and `match_ingredients` (supabase/migrations/20260228155119_pgvector_embeddings.sql)
 * share one signature:
 *
 *   RETURNS TABLE (
 *     id text, name_primary text, name_alt text[], name_en text,
 *     state text, similarity float
 *   )
 *
 * Nullability, column by column against `vietnamese_food_composition` in
 * lib/infra/db/schema.ts:
 * - `id`, `name_primary` and `state` are NOT NULL on the table and both
 *   function bodies project them verbatim (`SELECT vfc.id, vfc.name_primary,
 *   …`), so no row can carry a null there.
 * - `name_en` is NOT NULL on the table too, but it is re-emitted through a
 *   `RETURNS TABLE` OUT parameter, which PostgreSQL types as nullable whatever
 *   the source column says. **Widened** for that reason; nothing reads it.
 * - `name_alt` is a nullable `text[]`.
 * - `similarity` is computed (`1 - (embedding <=> query)` / `word_similarity`),
 *   never null.
 *
 * A type alias rather than an interface: `db.execute<TRow>` constrains TRow to
 * `Record<string, unknown>`, and a TS interface has no implicit index
 * signature, so an interface cannot be passed as the generic.
 */
export type FuzzyMatchRow = {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string | null;
  state: string;
  similarity: number;
};
