import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { NUTRITION_KEYS } from '../constants';
import type { NutritionPer100g, UnmatchedIngredient } from '../types';

/** Maps NutritionPer100g keys (camelCase) to DB column names (snake_case) */
export const DB_NUTRITION_COLUMNS: Record<keyof NutritionPer100g, string> = {
  caloriesKcal: 'calories_kcal',
  proteinG: 'protein_g',
  carbohydrateG: 'carbohydrate_g',
  fatG: 'fat_g',
  fiberG: 'fiber_g',
  sodiumMg: 'sodium_mg',
  calciumMg: 'calcium_mg',
  ironMg: 'iron_mg',
  magnesiumMg: 'magnesium_mg',
  phosphorusMg: 'phosphorus_mg',
  potassiumMg: 'potassium_mg',
  zincMg: 'zinc_mg',
  copperMcg: 'copper_mcg',
  manganeseMg: 'manganese_mg',
  betaCaroteneMcg: 'beta_carotene_mcg',
  vitaminAMcg: 'vitamin_a_mcg',
  vitaminDMcg: 'vitamin_d_mcg',
  vitaminEMg: 'vitamin_e_mg',
  vitaminKMcg: 'vitamin_k_mcg',
  vitaminCMg: 'vitamin_c_mg',
  vitaminB1Mg: 'vitamin_b1_mg',
  vitaminB2Mg: 'vitamin_b2_mg',
  vitaminPpMg: 'vitamin_pp_mg',
  vitaminB5Mg: 'vitamin_b5_mg',
  vitaminB6Mg: 'vitamin_b6_mg',
  vitaminB9Mcg: 'vitamin_b9_mcg',
  vitaminB12Mcg: 'vitamin_b12_mcg',
  vitaminHMcg: 'vitamin_h_mcg',
};

/** Columns required by parseNutritionRow — use this to avoid SELECT * */
export const NUTRITION_SELECT_COLUMNS = [
  'id',
  ...Object.values(DB_NUTRITION_COLUMNS),
] as const;

/**
 * Columns the nutrition cache's `loadAll` needs: the nutrition fields
 * (`NUTRITION_SELECT_COLUMNS`) plus `inedible_portion_pct` for the inedible
 * cache. Deliberately excludes the 768-dim `embedding` vector — pulling it for
 * all ~526 rows was a multi-MB cross-region load on the cold matching path
 * (the L1 embedding warm now runs independently; see embedding-cache.ts).
 */
export const NUTRITION_CACHE_SELECT_COLUMNS = [
  ...NUTRITION_SELECT_COLUMNS,
  'inedible_portion_pct',
] as const;

export function parseNutritionRow(
  row: Record<string, unknown>
): NutritionPer100g {
  const result = {} as Record<string, number | null>;

  for (const key of NUTRITION_KEYS) {
    const dbCol = DB_NUTRITION_COLUMNS[key];
    const rawVal = row[dbCol];
    result[key] = rawVal != null ? Number(rawVal) : null;
  }

  return result as unknown as NutritionPer100g;
}

export async function fetchNutritionPer100g(
  foodCompositionId: string,
  db: PostgresJsDatabase<any>
): Promise<NutritionPer100g | null> {
  const rows = await db.execute(
    sql`SELECT * FROM vietnamese_food_composition WHERE id = ${foodCompositionId} LIMIT 1`
  );

  if (rows.length === 0) return null;
  return parseNutritionRow(rows[0] as Record<string, unknown>);
}

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
