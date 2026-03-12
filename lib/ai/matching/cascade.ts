import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { GeminiClient } from '../gemini';
import type {
  DecomposedIngredient,
  MatchConfidence,
  MatchedIngredient,
  UnmatchedIngredient,
} from '../types';
import { fetchNutritionPer100g } from './nutrition-db';

export const CONFIDENCE_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
} as const;

export function classifyConfidence(similarity: number): MatchConfidence {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

export interface MatchResult {
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
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
  gemini: GeminiClient
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];

  for (const ingredient of ingredients) {
    const result = await matchSingleIngredient(ingredient.name, db, gemini);

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

async function matchSingleIngredient(
  ingredientName: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchedIngredient | null> {
  // Step 1: Try fuzzy match (pg_trgm)
  const fuzzyRows = await db.execute(
    sql`SELECT * FROM fuzzy_match_ingredients(${ingredientName}, 3, 0.15)`
  );
  const fuzzyResult = await buildMatchResult(
    ingredientName,
    fuzzyRows as unknown as FuzzyMatchRow[],
    db
  );
  if (fuzzyResult) return fuzzyResult;

  // Step 2: Fall back to vector search (pgvector)
  const embedding = await gemini.generateEmbedding(ingredientName);
  const vectorRows = await db.execute(
    sql`SELECT * FROM match_ingredients(${JSON.stringify(embedding)}::vector, 3, 0.5)`
  );
  return buildMatchResult(
    ingredientName,
    vectorRows as unknown as FuzzyMatchRow[],
    db
  );
}

async function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  db: PostgresJsDatabase
): Promise<MatchedIngredient | null> {
  if (rows.length === 0) return null;

  const topMatch = rows[0];
  const nutrition = await fetchNutritionPer100g(topMatch.id, db);
  if (!nutrition) return null;

  return {
    ingredientName,
    foodCompositionId: topMatch.id,
    matchedName: topMatch.name_primary,
    similarity: topMatch.similarity,
    confidence: classifyConfidence(topMatch.similarity),
    nutritionPer100g: nutrition,
  };
}
