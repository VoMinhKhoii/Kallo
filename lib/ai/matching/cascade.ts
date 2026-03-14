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

/** Minimum similarity to accept a fuzzy (pg_trgm) match */
export const FUZZY_SIMILARITY_THRESHOLD = 0.4;

/** Minimum similarity to accept a vector (pgvector) match */
export const VECTOR_SIMILARITY_THRESHOLD = 0.75;

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
 * Each ingredient is processed independently — run in parallel with Promise.allSettled.
 */
export async function matchIngredients(
  ingredients: DecomposedIngredient[],
  mealContext: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];

  const results = await Promise.allSettled(
    ingredients.map((ingredient) =>
      matchSingleIngredient(ingredient.name, db, gemini)
    )
  );

  for (let i = 0; i < ingredients.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      matched.push(result.value);
    } else {
      if (result.status === 'rejected') {
        console.error(
          `[matching] Failed to match "${ingredients[i].name}":`,
          result.reason
        );
      }
      unmatched.push({
        ingredientName: ingredients[i].name,
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
    FUZZY_SIMILARITY_THRESHOLD,
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
    VECTOR_SIMILARITY_THRESHOLD,
    db
  );
}

async function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number,
  db: PostgresJsDatabase
): Promise<MatchedIngredient | null> {
  if (rows.length === 0) return null;

  const topMatch = rows[0];
  if (topMatch.similarity < minSimilarity) return null;

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
