// LLM Call 1 output: Meal decomposition.

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
