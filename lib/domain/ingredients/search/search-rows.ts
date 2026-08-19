// The row shapes the ingredient-search SQL returns, and the single parser that
// turns one into an `IngredientSearchResult`.
//
// `db.execute` hands back rows the driver cannot type, so these declarations
// are the only description of the shape — each field below was read off the
// SELECT that produces it and the `vietnamese_food_composition` column it comes
// from. They must never claim more than the SQL proves.

import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';

/**
 * The projection shared by all four ingredient-search queries: two read
 * `vietnamese_food_composition` directly (recents, substring backfill), two go
 * through the `fuzzy_match_ingredients_all_sources` / `match_ingredients`
 * set-returning functions and JOIN the table back for the macros.
 *
 * Nullability, verified column by column:
 * - `id`, `name_primary`, `state` are NOT NULL on the table.
 * - `name_en` is NOT NULL on the table too, but the lexical and semantic arms
 *   re-emit it through a `RETURNS TABLE` OUT parameter, which PostgreSQL types
 *   as nullable whatever the source column says. Widened, and the parser has
 *   always tolerated a null here.
 * - `name_alt` is a nullable `text[]`.
 * - the four macro columns are nullable `numeric`; postgres.js returns
 *   `numeric` as a **string** (never a number) to avoid precision loss.
 * - `similarity` is `float8` from the two search functions and a literal
 *   `0::float` in the substring backfill — and is ABSENT from the recents
 *   projection, which is why it is optional and why the parser defaults a
 *   missing value to 1.
 */
export type IngredientSearchRow = {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string | null;
  state: string;
  similarity?: number | null;
  calories_kcal: string | null;
  protein_g: string | null;
  carbohydrate_g: string | null;
  fat_g: string | null;
};

/** The recents projection adds `MAX(m.logged_at) AS last_used` (a `timestamptz`
 *  aggregate, so a `Date`). It only orders the query — the parser ignores it. */
export type RecentIngredientRow = IngredientSearchRow & { last_used: Date };

export function toSearchResult(
  row: IngredientSearchRow
): IngredientSearchResult {
  return {
    id: String(row.id),
    namePrimary: String(row.name_primary),
    nameEn: row.name_en == null ? null : String(row.name_en),
    nameAlt: Array.isArray(row.name_alt) ? row.name_alt.map(String) : null,
    state: String(row.state),
    similarity: row.similarity == null ? 1 : Number(row.similarity),
    per100g: {
      caloriesKcal:
        row.calories_kcal == null ? null : Number(row.calories_kcal),
      proteinG: row.protein_g == null ? null : Number(row.protein_g),
      carbohydrateG:
        row.carbohydrate_g == null ? null : Number(row.carbohydrate_g),
      fatG: row.fat_g == null ? null : Number(row.fat_g),
    },
  };
}
