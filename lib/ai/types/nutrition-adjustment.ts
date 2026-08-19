import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';

// ---------------------------------------------------------------------------
// LLM Call 2 output: Cooking-adjusted bounded estimates (4 macros only)
// ---------------------------------------------------------------------------
//
// Contract (2026-05-13): the LLM emits absolute {low, mid, high} per macro,
// but only `fatG` flows downstream for matched ingredients. At resolve time
// (`lib/ai/pipeline/resolve/macro-resolution.ts`):
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
