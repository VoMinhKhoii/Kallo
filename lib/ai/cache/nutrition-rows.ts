import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';

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
  'type_en',
] as const;

/**
 * The row shape `NUTRITION_CACHE_SELECT_COLUMNS` produces — the type-level twin
 * of that list, so `db.execute<NutritionCacheRow>(…)` needs no cast. Nullability
 * is read off the Drizzle definition of `vietnamese_food_composition`
 * (lib/db/schema.ts):
 *
 *   id                   text, primary key            → notNull
 *   type_en              text('type_en').notNull()    → notNull
 *   inedible_portion_pct numeric(…)                   → nullable
 *
 * The 27 nutrient columns stay under the index signature on purpose: they are
 * read dynamically through `DB_NUTRITION_COLUMNS`, never by literal name, and
 * `parseNutritionRow` already coerces each one. `numeric` arrives from
 * postgres-js as a *string* (it will not silently lose precision), which is why
 * the readers run every value through `Number()`.
 */
export type NutritionCacheRow = Record<string, unknown> & {
  id: string;
  type_en: string;
  inedible_portion_pct: string | null;
};

/** Row shape of the narrower `SELECT id, inedible_portion_pct` variant. */
export type InediblePctRow = {
  id: string;
  inedible_portion_pct: string | null;
};

export function parseNutritionRow(
  row: Record<string, unknown>
): NutritionPer100g {
  // Keyed by `keyof NutritionPer100g` rather than by `string`, so the loop below
  // is checked against the 28 nutrient names and the accumulator IS the result
  // type once every key is written — no cast back out.
  const result = {} as Record<keyof NutritionPer100g, number | null>;

  for (const key of NUTRITION_KEYS) {
    const dbCol = DB_NUTRITION_COLUMNS[key];
    const rawVal = row[dbCol];
    result[key] = rawVal != null ? Number(rawVal) : null;
  }

  return result;
}

export async function fetchNutritionPer100g(
  foodCompositionId: string,
  db: PostgresJsDatabase<any>
): Promise<NutritionPer100g | null> {
  // Deliberately left at `execute`'s default row type. This is the one
  // nutrition query that is a `SELECT *` over the whole table rather than an
  // explicit column list, so no honest row type can be written for it — the
  // shape is "every column of vietnamese_food_composition as of today",
  // including the ones nothing here reads. `parseNutritionRow` picks the 28 it
  // needs out of the resulting `Record<string, unknown>` by name and coerces
  // each one, which is exactly the guarantee the default type already gives.
  const rows = await db.execute(
    sql`SELECT * FROM vietnamese_food_composition WHERE id = ${foodCompositionId} LIMIT 1`
  );

  if (rows.length === 0) return null;
  return parseNutritionRow(rows[0]);
}
