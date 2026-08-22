import type { NutritionValues } from '@/lib/ai/types/nutrition-values';

// DB matching results — what retrieval + exact-match against FAO/USDA returns.

/** Confidence level for individual ingredient DB matching */
export type MatchConfidence = 'high' | 'medium' | 'low';

/** Nutrition per 100g from the food composition DB */
export type NutritionPer100g = NutritionValues;

/** Strategy that produced the winning match (vector pgvector vs fuzzy pg_trgm) */
export type MatchType = 'vector' | 'fuzzy';

/** Food-composition source the winning match came from */
export type MatchSource = 'fao' | 'usda';

/** A successfully matched ingredient */
export interface MatchedIngredient {
  /**
   * Run-scoped compact ingredient ID (§0.1) — propagated from decomposition.
   * Optional on the shared interface; cascade callers pass post-Task-1.9
   * `MealDecompositionWithIds` so this is populated at runtime. Test
   * fixtures may omit this field.
   */
  ingredientId?: string;
  ingredientName: string;
  foodCompositionId: string;
  /** Authoritative DB food-group taxonomy from the winning composition row. */
  foodGroupEn?: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  nutritionPer100g: NutritionPer100g;
  /** DB-enforced row state (§0.2). 'unknown' when the row pre-dates the column. */
  dbState: 'raw' | 'cooked' | 'unknown';
  /** Diagnostic: which strategy produced the match. Optional for backward-compat with mocks. */
  matchType?: MatchType;
  /** Diagnostic: which DB source the match came from. */
  source?: MatchSource;
  /** Diagnostic: wall-clock time for the winning match attempt (DB roundtrips). */
  latencyMs?: number;
  /** Diagnostic: true when the original name failed and the alias-fallback rescued it. */
  viaAlias?: boolean;
}

/** An unmatched ingredient — logged for future DB expansion */
export interface UnmatchedIngredient {
  ingredientName: string;
  mealContext: string;
}
