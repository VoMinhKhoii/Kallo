import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { ingredientSearchQuerySchema } from '@/lib/api/contracts/ingredients';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import type { IngredientSearchResult } from '@/lib/logging/manual-logging';

export const runtime = 'nodejs';

/** Strip Vietnamese diacritics client-side of the DB (matches how
 *  `search_text_ascii` was generated) so the prefix fallback never depends on
 *  the connection's search_path exposing the unaccent extension. */
function toAscii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function toSearchResult(row: Record<string, unknown>): IngredientSearchResult {
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

/** The user's most recently logged ingredients — instant suggestions shown
 *  before they type (Cronometer-style "recent foods"). */
async function loadRecentIngredients(
  userId: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  const rows = await db.execute(sql`
    SELECT v.id, v.name_primary, v.name_alt, v.name_en, v.state,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g,
           MAX(m.logged_at) AS last_used
    FROM meal_items mi
    JOIN meals m ON m.id = mi.meal_id
    JOIN vietnamese_food_composition v ON v.id = mi.food_composition_id
    WHERE m.user_id = ${userId}
    GROUP BY v.id
    ORDER BY last_used DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as Record<string, unknown>[]).map(toSearchResult);
}

async function searchIngredients(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  // Primary: trigram match via search_ingredients_by_name (branches diacritic
  // vs ASCII internally). It ranks with word_similarity — the query against
  // the best-matching extent of each name, with name_alt scored per variant —
  // so short queries like "ức gà" surface the long-named USDA body-part
  // entries instead of being drowned by short generic FAO names. The function
  // already orders by score, then curated FAO (source_id 1) before translated
  // USDA, then shorter names; the JOIN just adds per-100g macros.
  const fuzzyRows = await db.execute(sql`
    SELECT f.id, f.name_primary, f.name_alt, f.name_en, f.state, f.similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM search_ingredients_by_name(${q}, ${limit}, 0.15) f
    JOIN vietnamese_food_composition v ON v.id = f.id
    ORDER BY f.similarity DESC, v.source_id ASC
  `);
  const results = (fuzzyRows as unknown as Record<string, unknown>[]).map(
    toSearchResult
  );
  if (results.length >= limit) return results;

  // Supplement: trigram similarity is unreliable for short queries (Vietnamese
  // staples like "gà", "bò", "cá"), so backfill with a substring match against
  // the precomputed ASCII search text, prefix matches first.
  const ascii = toAscii(q);
  const prefixRows = await db.execute(sql`
    SELECT v.id, v.name_primary, v.name_alt, v.name_en, v.state,
           0::float AS similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM vietnamese_food_composition v
    WHERE v.search_text_ascii LIKE ${`%${ascii}%`}
    ORDER BY (v.search_text_ascii LIKE ${`${ascii}%`}) DESC,
             v.source_id ASC,
             length(v.name_primary) ASC
    LIMIT ${limit}
  `);
  const seen = new Set(results.map((r) => r.id));
  for (const row of prefixRows as unknown as Record<string, unknown>[]) {
    if (results.length >= limit) break;
    const result = toSearchResult(row);
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    results.push(result);
  }
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuthAndProfile();
    const { q, limit } = ingredientSearchQuerySchema.parse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    // No AI-cost guards here: this is a cheap indexed query, throttled by auth,
    // the limit cap, and client-side debounce.
    const results = q
      ? await searchIngredients(q, limit)
      : await loadRecentIngredients(user.id, limit);

    return Response.json({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}
