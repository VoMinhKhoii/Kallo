import { sql } from 'drizzle-orm';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { db } from '@/lib/infra/db';
import { type RecentIngredientRow, toSearchResult } from './search-rows';

/** The user's most recently logged ingredients — instant suggestions shown
 *  before they type (Cronometer-style "recent foods"). */
export async function loadRecentIngredients(
  userId: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  const rows = await db.execute<RecentIngredientRow>(sql`
    SELECT v.id, v.name_primary, v.name_alt, v.name_en, v.state,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g,
           MAX(m.logged_at) AS last_used
    FROM meal_items mi
    JOIN meals m ON m.id = mi.meal_id
    JOIN vietnamese_food_composition v ON v.id = mi.food_composition_id
    WHERE m.user_id = ${userId}
      -- Recents older than this aren't useful suggestions; the bound keeps the
      -- aggregation from scanning a user's lifetime history.
      AND m.logged_at > now() - interval '90 days'
    GROUP BY v.id
    ORDER BY last_used DESC
    LIMIT ${limit}
  `);
  return rows.map(toSearchResult);
}
