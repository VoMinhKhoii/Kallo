import type { CookingHabits, Goal } from '@/lib/onboarding/types';
import type {
  MealInputLanguage,
  SupportedOutputLanguage,
} from './language/detect';

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

export type ExpectedIngredientState = 'raw' | 'cooked';
export type ExpectedIngredientStateSource =
  | 'explicit'
  | 'method_lookup'
  | 'unknown';

export type AmbiguityFlag =
  | 'multiple_dish_interpretations'
  | 'unspecified_quantity'
  | 'cross_cuisine_ingredient'
  | 'state_inferred_no_method';

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
  inputLanguage?: MealInputLanguage;
  outputLanguage?: SupportedOutputLanguage;
  cookingHabits: CookingHabits;
}

// ---------------------------------------------------------------------------
// LLM Call 1 output: Meal decomposition
// ---------------------------------------------------------------------------

/** Single ingredient extracted by LLM from a meal item */
export interface DecomposedIngredient {
  /** Stable id emitted by the LLM and normalized by runtime (§0.1). */
  ingredientId?: string;
  /** User-facing/input-preserving name. */
  rawName?: string;
  /** Food-composition vocabulary name used for matching. */
  canonicalName?: string;
  /** As-eaten grams; colloquial unit conversion is owned by the LLM. */
  grams?: number;
  /** Optional per-ingredient state override; dish cookingMethod fills gaps. */
  expectedState?: ExpectedIngredientState;
  /**
   * Weighing reference for `grams`. 'raw' means the user gave the pre-cooking
   * mass (e.g. "cân sống", "raw weight"); runtime then uses grams directly
   * against a raw DB row and skips `convertCookedToRaw`. Absent ≡ 'as_eaten'.
   */
  weightBasis?: 'raw' | 'as_eaten';
  /**
   * Short verbatim user-typed preparation modifiers (e.g. ["bỏ da", "bỏ mỡ"],
   * ["nước trong"]) that change macro density for the SAME matched food.
   * Non-empty unlocks a widened — but tightly bounded — guard band in
   * `resolveIngredientMacros`. Absent / empty ≡ default DB anchoring.
   */
  prepNotes?: string[];
  /** Aggregate-only ambiguity side channel; never a routing input. */
  ambiguityFlags?: AmbiguityFlag[];
  /** Runtime-only derivation source for state tie-breaker confidence. */
  _stateSource?: ExpectedIngredientStateSource;
  /** @deprecated Transitional support for pre-§2 direct test fixtures only. */
  name?: string;
  /** @deprecated Use `grams`; kept for direct test fixtures during migration. */
  estimatedGrams?: number;
  /** @deprecated Use dish-level `cookingMethod` + `expectedState`. */
  cookingMethod?: string | null;
  /** @deprecated Runtime no longer accepts or emits user-facing units. */
  userFacingUnit?: string | null;
}

/** A user-facing meal item with its internal ingredient breakdown */
export interface DecomposedMealItem {
  /** Stable id emitted by the LLM and normalized by runtime (§0.1). */
  mealItemId?: string;
  name: string;
  cookingMethod?: string;
  cuisineNote?: string;
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

// ---------------------------------------------------------------------------
// LLM Call 2 output: Cooking-adjusted bounded estimates (4 macros only)
// ---------------------------------------------------------------------------
//
// Contract (2026-05-13): the LLM emits absolute {low, mid, high} per macro,
// but only `fatG` flows downstream for matched ingredients. At resolve time
// (`lib/ai/pipeline/nutrition.ts`):
//   - matched P and C are flat triples at the DB-anchored base value;
//   - matched fat keeps the LLM triple subject to the 3× hallucination guard
//     (which also catches structurally-invalid triples and falls back to a
//     flat triple at base.fatG);
//   - matched kcal is derived from the macro identity 4P + 4C + 9F, so only
//     fat's spread (when present) drives goal-adjustment;
//   - unmatched ingredients flow through P/C/F verbatim, kcal is derived,
//     and a density clamp (`MAX_KCAL_PER_100G`) scales the triple if it
//     exceeds the physical ceiling.

/**
 * Server-computed base values per macro, keyed by run-scoped ingredient ID.
 * Built from `nutritionPer100g × dbScalingGrams / 100` using the same
 * `convertCookedToRaw` logic that `assembly.ts` applies to the 24 non-macro
 * nutrients. Passed to the nutrition prompt (rendered as `<base>` per matched
 * ingredient) and to `resolveIngredientMacros` for server anchoring.
 * Absent entries (unmatched ingredients) mean the LLM owns all four macros.
 */
export interface MacroBase {
  caloriesKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
}

/** Bounded estimates for the 4 LLM-adjusted macros of a single ingredient. */
export interface IngredientLlmNutrition {
  /**
   * Run-scoped compact ingredient ID (§0.1). Filled by `reconcileNutritionIds`
   * after Call 2 parses. Optional on the interface; the post-reconcile shape
   * consumed by assembly always carries it.
   */
  ingredientId?: string;
  ingredientName: string;
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
}

/**
 * Unified four-macro ingredient nutrition record for eval/shadow consumers.
 * Runtime `BoundedNutrition` still carries the full 28-nutrient detail; this
 * shape is the stable spec §1.1 contract for comparing model outputs.
 */
export interface IngredientNutrition {
  ingredientId: string;
  matchedDbId?: string | null;
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
  uncertaintyReason?: string | null;
}

/** LLM Call 2 output for a single meal item */
export interface MealItemNutrition {
  /**
   * Run-scoped compact meal-item ID (§0.1). Filled by `reconcileNutritionIds`.
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
   * the legacy cooked-to-raw fallback when the row is raw or dbState is
   * 'unknown'. Display layers should use `estimatedGrams`.
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

/**
 * Phase 1: the pipeline finished but ≥1 ingredient's portion or food match
 * couldn't be resolved. The route emits a precise-mode `clarify` event for
 * the most-impactful item INSTEAD of persisting an under-weighted meal.
 * Present only on the v2 grounded path; v1 never sets it.
 */
export interface PipelineUnresolved {
  /** Owning meal-item name of the most-impactful unresolved ingredient. */
  mealItemName: string;
  /** The unresolved ingredient's display name. */
  ingredientName: string;
  /**
   * Why it's unresolved — drives the clarify `reason`.
   * 'processing_incomplete' = a Call-2 chunk failed after retries (transient),
   * NOT a gap in the user's input — the route emits a retryable error, not a
   * clarify question about a portion the user already stated.
   */
  reason: 'unresolved_portion' | 'ambiguous_food' | 'processing_incomplete';
  /** Count of unresolved ingredients across the whole meal. */
  unresolvedCount: number;
}

/** Discriminated union result type */
export type PipelineResponse =
  | {
      success: true;
      data: PipelineResult;
      /** Set when ≥1 ingredient couldn't be resolved (see PipelineUnresolved). */
      unresolved?: PipelineUnresolved;
      __telemetry?: import('./pipeline/telemetry/run-telemetry').PipelineRunRow;
      __telemetryRunId?: string;
      /** Resolves once the pipeline_runs row insert has committed.
       * Consumers that need the row to exist before referencing it via FK
       * (e.g. pipeline_shadow_runs.primary_run_id) must await this. */
      __telemetryRunPersisted?: Promise<void>;
    }
  | {
      success: false;
      error: PipelineError;
      __telemetry?: import('./pipeline/telemetry/run-telemetry').PipelineRunRow;
      __telemetryRunId?: string;
      __telemetryRunPersisted?: Promise<void>;
    };
