import { sql } from 'drizzle-orm';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { db } from '@/lib/infra/db';
import { type IngredientSearchRow, toSearchResult } from './search-rows';

/** Lexical (trigram) arm: fuzzy_match_ingredients_all_sources — the same
 *  word_similarity ranking the v2 AI matcher uses. Per-source rows collapse
 *  into one list: score first, curated FAO (source_id 1) before translated
 *  USDA on ties, shorter names first; the JOIN adds per-100g macros. */
export async function lexicalSearch(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  const rows = await db.execute<IngredientSearchRow>(sql`
    SELECT f.id, f.name_primary, f.name_alt, f.name_en, f.state, f.similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM fuzzy_match_ingredients_all_sources(${q}, ${limit}, 0.15) f
    JOIN vietnamese_food_composition v ON v.id = f.id
    WHERE f.similarity >= 0.15
    ORDER BY f.similarity DESC, f.source_id ASC, length(f.name_primary) ASC
    LIMIT ${limit}
  `);
  return rows.map(toSearchResult);
}
