import { sql } from 'drizzle-orm';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { db } from '@/lib/infra/db/client';
import { type IngredientSearchRow, toSearchResult } from './search-rows';

/**
 * Top the ranked list up to `limit` with substring hits, skipping ids already
 * present. Trigram similarity is unreliable for short queries (Vietnamese
 * staples like "gà", "bò", "cá"), so this backfills with a substring match
 * against the precomputed ASCII search text, prefix matches first.
 *
 * The query is folded with the DB's own unaccent — the exact algorithm the
 * trigger used to generate search_text_ascii, so the two sides can't drift.
 */
export async function backfillWithSubstringMatches(
  ranked: IngredientSearchResult[],
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  const seen = new Set(ranked.map((r) => r.id));
  const rows = await db.execute<IngredientSearchRow>(sql`
    SELECT v.id, v.name_primary, v.name_alt, v.name_en, v.state,
           0::float AS similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM vietnamese_food_composition v,
         lower(extensions.unaccent(${q})) AS ascii_q
    WHERE v.search_text_ascii LIKE '%' || ascii_q || '%'
    ORDER BY (v.search_text_ascii LIKE ascii_q || '%') DESC,
             v.source_id ASC,
             length(v.name_primary) ASC
    LIMIT ${limit}
  `);
  const filled = [...ranked];
  for (const row of rows) {
    if (filled.length >= limit) break;
    const result = toSearchResult(row);
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    filled.push(result);
  }
  return filled;
}
