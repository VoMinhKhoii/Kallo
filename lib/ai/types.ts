import type { CookingHabits, Goal } from '@/lib/onboarding/types';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Bounded estimate stored as JSONB {low, mid, high} in meals/meal_items */
export interface BoundedEstimate {
  low: number;
  mid: number;
  high: number;
}

/** Confidence level for individual ingredient DB matching */
export type MatchConfidence = 'high' | 'medium' | 'low';

/** Confidence level for overall meal analysis */
export type MealConfidence = 'high' | 'medium' | 'low';

/** Meal slot classification */
export type MealSlot = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'snack';

// ---------------------------------------------------------------------------
// Nutrition value containers
// ---------------------------------------------------------------------------

/**
 * Flat nutrition values — all 28 nutrients tracked by the system.
 * Used for: per-100g DB values, displayed (goal-adjusted) values.
 * Fields are nullable because not all foods have data for all nutrients.
 */
export interface NutritionValues {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  magnesiumMg: number | null;
  phosphorusMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  copperMcg: number | null;
  manganeseMg: number | null;
  betaCaroteneMcg: number | null;
  vitaminAMcg: number | null;
  vitaminDMcg: number | null;
  vitaminEMg: number | null;
  vitaminKMcg: number | null;
  vitaminCMg: number | null;
  vitaminB1Mg: number | null;
  vitaminB2Mg: number | null;
  vitaminPpMg: number | null;
  vitaminB5Mg: number | null;
  vitaminB6Mg: number | null;
  vitaminB9Mcg: number | null;
  vitaminB12Mcg: number | null;
  vitaminHMcg: number | null;
}

/** Bounded nutrition — each nutrient has low/mid/high or null */
export type BoundedNutrition = {
  [K in keyof NutritionValues]: BoundedEstimate | null;
};

// ---------------------------------------------------------------------------
// Goal adjustment types
// ---------------------------------------------------------------------------

/** The 4 macros that get goal-adjusted (shown to users) */
export type GoalAdjustedNutrient =
  | 'caloriesKcal'
  | 'proteinG'
  | 'carbohydrateG'
  | 'fatG';

// ---------------------------------------------------------------------------
// User context (gathered from user_profiles for pipeline)
// ---------------------------------------------------------------------------

/** User context needed by the pipeline — queried from user_profiles at call time */
export interface UserContext {
  goal: Goal;
  aggression: number; // 0.1-0.8 for cutting/bulking, 0 for maintaining (null → 0)
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
  cookingHabits: CookingHabits;
}

// ---------------------------------------------------------------------------
// LLM Call 1 output: Meal decomposition
// ---------------------------------------------------------------------------

/** Single ingredient extracted by LLM from a meal item */
export interface DecomposedIngredient {
  /**
   * Run-scoped stable UUID (§0.1). Optional in this type because Zod
   * accepts the LLM emitting it or omitting it; the runtime helper
   * `ensureIdsOnDecomposition` (§0.1) guarantees a valid UUID is
   * present on every value produced by the orchestrator.
   */
  ingredientId?: string;
  name: string;
  estimatedGrams: number;
  cookingMethod: string | null;
  userFacingUnit: string | null;
}

/** A user-facing meal item with its internal ingredient breakdown */
export interface DecomposedMealItem {
  /**
   * Run-scoped stable UUID (§0.1). See `DecomposedIngredient.ingredientId`
   * for the rationale on optionality at the type level.
   */
  mealItemId?: string;
  name: string;
  ingredients: DecomposedIngredient[];
}

/** Full output of LLM Call 1 */
export interface MealDecomposition {
  isFood: boolean;
  mealItems: DecomposedMealItem[];
  mealSlot: MealSlot | null;
}

// ---------------------------------------------------------------------------
// DB matching results
// ---------------------------------------------------------------------------

/** Nutrition per 100g from the food composition DB */
export type NutritionPer100g = NutritionValues;

/** A successfully matched ingredient */
export interface MatchedIngredient {
  /**
   * Run-scoped ingredient UUID (§0.1) — propagated from decomposition.
   * Optional on the shared interface; cascade callers pass post-Task-1.9
   * `MealDecompositionWithIds` so this is populated at runtime. Test
   * fixtures may omit this field.
   */
  ingredientId?: string;
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  nutritionPer100g: NutritionPer100g;
  /** DB-enforced row state (§0.2). 'unknown' when the row pre-dates the column. */
  dbState: 'raw' | 'cooked' | 'unknown';
}

/** An unmatched ingredient — logged for future DB expansion */
export interface UnmatchedIngredient {
  ingredientName: string;
  mealContext: string;
}

// ---------------------------------------------------------------------------
// LLM Call 2 output: Cooking-adjusted bounded estimates (4 macros only)
// ---------------------------------------------------------------------------

/** Bounded estimates for the 4 LLM-adjusted macros of a single ingredient */
export interface IngredientLlmNutrition {
  /**
   * Run-scoped ingredient UUID (§0.1). Filled by `reconcileNutritionIds`
   * after Call 2 parses (LLM emits ingredientName today; Chunk 3 will
   * have it emit ingredientId directly). Optional on the interface; the
   * post-reconcile shape consumed by assembly always carries it.
   */
  ingredientId?: string;
  ingredientName: string;
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
}

/** LLM Call 2 output for a single meal item */
export interface MealItemNutrition {
  /**
   * Run-scoped meal-item UUID (§0.1). Filled by `reconcileNutritionIds`.
   * Optional on the interface; reconciled output always carries it.
   */
  mealItemId?: string;
  mealItemName: string;
  ingredients: IngredientLlmNutrition[];
}

/** Full output of LLM Call 2 */
export interface NutritionAdjustment {
  mealItems: MealItemNutrition[];
}

// ---------------------------------------------------------------------------
// Pipeline result (returned to caller)
// ---------------------------------------------------------------------------

/** Final processed ingredient in the pipeline result */
export interface ProcessedIngredient {
  ingredientName: string;
  foodCompositionId: string | null;
  estimatedGrams: number;
  /**
   * Grams used internally for DB-row nutrition scaling. Equals
   * `estimatedGrams` when the matched DB row is cooked. Equals
   * `convertCookedToRaw(estimatedGrams, cookingMethod)` when the row is raw or
   * dbState is 'unknown'. Display layers should use `estimatedGrams`.
   *
   * @deprecated Field name is misleading post-Chunk 3. Rename to
   * `dbScalingGrams` in a follow-up once spec §1.5 retirement gate trips and
   * the legacy fallback is removed entirely.
   */
  rawEquivalentGrams: number;
  cookingMethod: string | null;
  userFacingUnit: string | null;
  matchConfidence: number | null;
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
}

/** Final processed meal item in the pipeline result */
export interface PipelineMealItem {
  name: string;
  ingredients: ProcessedIngredient[];
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
}

/** Full pipeline result for a successful analysis */
export interface PipelineResult {
  mealItems: PipelineMealItem[];
  mealSlot: MealSlot | null;
  confidenceOverall: MealConfidence;
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
  unmatchedIngredients: UnmatchedIngredient[];
}

/** Pipeline error types */
export type PipelineErrorType = 'non_food_input' | 'api_error' | 'parse_error';

export interface PipelineError {
  type: PipelineErrorType;
  message: string;
  retryable: boolean;
}

/** Discriminated union result type */
export type PipelineResponse =
  | { success: true; data: PipelineResult }
  | { success: false; error: PipelineError };
