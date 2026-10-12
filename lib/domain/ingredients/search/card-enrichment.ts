import { sql } from 'drizzle-orm';
import { cardDisplayFields } from '@/lib/domain/ingredients/display/card-display';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { db } from '@/lib/infra/db/client';

/** One row per result id: its food group and, when the row has a card, the
 *  card fields the picker displays. `food_cards` is keyed by the row id, so the
 *  LEFT JOIN yields at most one card per row. */
type CardDisplayRow = {
  id: string;
  name_primary: string;
  type_en: string | null;
  food: string | null;
  cooking_method: string | null;
  brand: string | null;
};

/**
 * Attach the display fields (clean English name, state label, brand, vessel)
 * to ranked results in one query, after ranking — so no retrieval arm changes
 * and the order is untouched. A failed lookup returns the results as they
 * were: the picker falls back to the row's own names, never to an error.
 */
export async function attachCardDisplay(
  results: IngredientSearchResult[]
): Promise<IngredientSearchResult[]> {
  if (results.length === 0) return results;
  const idList = sql.join(
    results.map((r) => sql`${r.id}`),
    sql`, `
  );
  let rows: CardDisplayRow[];
  try {
    const found = await db.execute<CardDisplayRow>(sql`
      SELECT v.id, v.name_primary, v.type_en, c.food, c.cooking_method, c.brand
      FROM vietnamese_food_composition v
      LEFT JOIN food_cards c ON c.food_composition_id = v.id
      WHERE v.id IN (${idList})
    `);
    if (!Array.isArray(found)) return results;
    rows = found;
  } catch (error) {
    console.error('[ingredient-search] card display lookup failed', error);
    return results;
  }

  const byId = new Map(rows.map((row) => [String(row.id), row]));
  return results.map((result) => {
    const row = byId.get(result.id);
    if (!row) return result;
    return {
      ...result,
      ...cardDisplayFields({
        namePrimary: String(row.name_primary),
        typeEn: row.type_en,
        food: row.food,
        cookingMethod: row.cooking_method,
        brand: row.brand,
      }),
    };
  });
}
