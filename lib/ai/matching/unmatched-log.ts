import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { UnmatchedIngredient } from '@/lib/ai/types/matching';

/**
 * Record the ingredients the cascade could not anchor to a food-composition
 * row. The `unmatched_ingredients` table is the input to alias curation — see
 * the alias tables in `lib/ai/matching/alias/aliases.ts`, which are expanded
 * from its contents.
 */
export async function logUnmatchedIngredients(
  items: UnmatchedIngredient[],
  mealId: string | null,
  db: PostgresJsDatabase<any>,
  userId?: string
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      db.execute(
        sql`INSERT INTO unmatched_ingredients (query_text, meal_context, meal_id, user_id)
            VALUES (${item.ingredientName}, ${item.mealContext}, ${mealId}, ${userId ?? null})`
      )
    )
  );
}
