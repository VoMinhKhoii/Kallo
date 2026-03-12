import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { GeminiClient } from './gemini';
import type {
  DecomposedIngredient,
  MatchConfidence,
  MatchedIngredient,
  NutritionPer100g,
  UnmatchedIngredient,
} from './types';
import { NUTRITION_KEYS } from './types';

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

export const CONFIDENCE_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
} as const;

export function classifyConfidence(similarity: number): MatchConfidence {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// DB result types (raw SQL returns)
// ---------------------------------------------------------------------------

interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

/** Maps NutritionPer100g keys (camelCase) to DB column names (snake_case) */
const DB_NUTRITION_COLUMNS: Record<keyof NutritionPer100g, string> = {
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

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseNutritionRow(
  row: Record<string, unknown>,
): NutritionPer100g {
  const result = {} as Record<string, number | null>;

  for (const key of NUTRITION_KEYS) {
    const dbCol = DB_NUTRITION_COLUMNS[key];
    const rawVal = row[dbCol];
    result[key] = rawVal != null ? Number(rawVal) : null;
  }

  return result as NutritionPer100g;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MatchResult {
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
}

/**
 * Fetch full nutrition per 100g for a food composition entry.
 */
export async function fetchNutritionPer100g(
  foodCompositionId: string,
  db: PostgresJsDatabase,
): Promise<NutritionPer100g | null> {
  const rows = await db.execute(
    sql`SELECT * FROM vietnamese_food_composition WHERE id = ${foodCompositionId} LIMIT 1`,
  );

  if (rows.length === 0) return null;
  return parseNutritionRow(rows[0] as Record<string, unknown>);
}

/**
 * Log unmatched ingredients to the database for future DB expansion.
 */
export async function logUnmatchedIngredients(
  items: UnmatchedIngredient[],
  mealId: string | null,
  db: PostgresJsDatabase,
): Promise<void> {
  for (const item of items) {
    await db.execute(
      sql`INSERT INTO unmatched_ingredients (query_text, meal_context, meal_id)
          VALUES (${item.ingredientName}, ${item.mealContext}, ${mealId})`,
    );
  }
}

/**
 * Match a list of decomposed ingredients against the food composition DB.
 *
 * Cascade: fuzzy_match_ingredients (pg_trgm) → match_ingredients (pgvector) → unmatched.
 * Each ingredient is processed independently (no shared state between iterations)
 * for easy future parallelization with Promise.all.
 */
export async function matchIngredients(
  ingredients: DecomposedIngredient[],
  mealContext: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient,
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];

  for (const ingredient of ingredients) {
    const result = await matchSingleIngredient(
      ingredient.name,
      mealContext,
      db,
      gemini,
    );

    if (result) {
      matched.push(result);
    } else {
      unmatched.push({
        ingredientName: ingredient.name,
        mealContext,
      });
    }
  }

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function matchSingleIngredient(
  ingredientName: string,
  _mealContext: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient,
): Promise<MatchedIngredient | null> {
  // Step 1: Try fuzzy match (pg_trgm)
  const fuzzyRows = await db.execute(
    sql`SELECT * FROM fuzzy_match_ingredients(${ingredientName}, 3, 0.15)`,
  );

  if (fuzzyRows.length > 0) {
    const topMatch = fuzzyRows[0] as unknown as FuzzyMatchRow;
    const nutrition = await fetchNutritionPer100g(topMatch.id, db);
    if (nutrition) {
      return {
        ingredientName,
        foodCompositionId: topMatch.id,
        matchedName: topMatch.name_primary,
        similarity: topMatch.similarity,
        confidence: classifyConfidence(topMatch.similarity),
        nutritionPer100g: nutrition,
      };
    }
  }

  // Step 2: Fall back to vector search (pgvector)
  const embedding = await gemini.generateEmbedding(ingredientName);
  const vectorRows = await db.execute(
    sql`SELECT * FROM match_ingredients(${JSON.stringify(embedding)}::vector, 3, 0.5)`,
  );

  if (vectorRows.length > 0) {
    const topMatch = vectorRows[0] as unknown as FuzzyMatchRow;
    const nutrition = await fetchNutritionPer100g(topMatch.id, db);
    if (nutrition) {
      return {
        ingredientName,
        foodCompositionId: topMatch.id,
        matchedName: topMatch.name_primary,
        similarity: topMatch.similarity,
        confidence: classifyConfidence(topMatch.similarity),
        nutritionPer100g: nutrition,
      };
    }
  }

  // Step 3: Unmatched
  return null;
}
