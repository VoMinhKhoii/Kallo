import { GOAL_ADJUSTED_NUTRIENTS, NUTRITION_KEYS } from '../constants';
import type {
  BoundedEstimate,
  BoundedNutrition,
  IngredientLlmNutrition,
  IngredientNutrition,
  MatchedIngredient,
  MealConfidence,
  MealDecomposition,
  NutritionAdjustment,
  NutritionValues,
  PipelineMealItem,
  PipelineResult,
  ProcessedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '../types';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from './goal-adjustment';
import { ingredientDisplayName, ingredientGrams } from './ingredient-accessors';
import { computeDbScalingGrams } from './nutrition';
import { normalizeBoundedEstimate } from './schemas';

export interface AssemblyMetrics {
  cookedToRawFactorFires: number;
}

export interface AssemblyOutput {
  result: PipelineResult;
  metrics: AssemblyMetrics;
  ingredientNutrition: IngredientNutrition[];
}

const ingredientCookingMethod = (
  item: MealDecomposition['mealItems'][number],
  ing: MealDecomposition['mealItems'][number]['ingredients'][number]
): string | null => ing.cookingMethod ?? item.cookingMethod ?? null;

/**
 * D5: Merge LLM-bounded macros with DB mid values for the remaining 24
 * nutrients.
 *
 * Post-2026-05-13 contract: the 4 macros in `llmNutrition` have already been
 * passed through `nutrition.ts:resolveIngredientMacros`, so:
 *   - matched ingredients: P and C are flat triples at the DB-anchored base,
 *     fat is LLM-mid with the hallucination guard and additive oil allowance,
 *     clamped at the nearest bound when needed; kcal is derived from
 *     4P + 4C + 9F. Only fat's spread (when present) drives goal-adjustment.
 *   - unmatched ingredients: P/C/F flow through from the LLM, kcal is derived
 *     from the macro identity, and a density clamp scales the triple if
 *     `kcal/100g > MAX_KCAL_PER_100G`.
 * The 24-nutrient branch below has always scaled `(per100g × estimatedGrams) / 100`
 * deterministically; it stays unchanged.
 *
 * `normalizeBoundedEstimate` is kept as defence-in-depth — the resolve step
 * guarantees ordering, so this is a no-op in the happy path but cheap insurance
 * against future drift.
 */
export function mergeNutrition(
  llmNutrition: IngredientLlmNutrition,
  dbNutrition: NutritionValues | null,
  estimatedGrams: number
): BoundedNutrition {
  const result = {} as Record<string, BoundedEstimate | null>;
  const llmKeys = new Set<string>(GOAL_ADJUSTED_NUTRIENTS);

  for (const key of NUTRITION_KEYS) {
    if (llmKeys.has(key)) {
      const raw = llmNutrition[key as keyof IngredientLlmNutrition];
      if (raw != null && typeof raw === 'object' && 'mid' in raw) {
        result[key] = normalizeBoundedEstimate(raw as BoundedEstimate);
      } else {
        result[key] = null;
      }
    } else {
      const per100g = dbNutrition?.[key as keyof NutritionValues] ?? null;
      if (per100g != null) {
        const scaled = (per100g * estimatedGrams) / 100;
        result[key] = { low: scaled, mid: scaled, high: scaled };
      } else {
        result[key] = null;
      }
    }
  }

  return result as unknown as BoundedNutrition;
}

function nullBoundedNutrition(): BoundedNutrition {
  return Object.fromEntries(
    NUTRITION_KEYS.map((key) => [key, null])
  ) as BoundedNutrition;
}

export function computeOverallConfidence(
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[]
): MealConfidence {
  if (matched.length === 0 && unmatched.length === 0) return 'low';

  const confidenceOrder: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  let lowest = matched.length > 0 ? 3 : 1;

  for (const m of matched) {
    const level = confidenceOrder[m.confidence] ?? 1;
    if (level < lowest) lowest = level;
  }

  if (unmatched.length > 0 && lowest > 2) {
    lowest = 2;
  }

  if (lowest >= 3) return 'high';
  if (lowest >= 2) return 'medium';
  return 'low';
}

export function assembleResult(
  decomposition: MealDecomposition,
  nutrition: NutritionAdjustment,
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext
): AssemblyOutput {
  const { goal, aggression } = userContext;
  let cookedToRawFactorFires = 0;
  const ingredientNutrition: IngredientNutrition[] = [];

  // Id-keyed lookup (§0.1): keying by ingredientName silently overwrites
  // when the same display name appears in two dishes (e.g. "nước dùng" in
  // pho and bún bò Huế). Skip entries without an id (interface allows
  // optional; reconciled runtime output always carries one).
  const matchedLookup = new Map<string, MatchedIngredient>();
  for (const m of matched) {
    if (m.ingredientId) matchedLookup.set(m.ingredientId, m);
  }

  // Composite key keyed by the run-scoped ingredientId; runtime guarantees
  // uniqueness so no last-write-wins risk.
  const llmNutritionByKey = new Map<string, IngredientLlmNutrition>();
  for (const mi of nutrition.mealItems) {
    for (const ing of mi.ingredients) {
      if (ing.ingredientId) llmNutritionByKey.set(ing.ingredientId, ing);
    }
  }

  const pipelineMealItems: PipelineMealItem[] = decomposition.mealItems.map(
    (decomposedItem) => {
      const ingredients: ProcessedIngredient[] = decomposedItem.ingredients.map(
        (ing) => {
          const ingredientId = ing.ingredientId;
          const matchInfo = ingredientId
            ? matchedLookup.get(ingredientId)
            : undefined;
          const llmData = ingredientId
            ? llmNutritionByKey.get(ingredientId)
            : undefined;

          // grams is the cooked/as-eaten weight (user-facing) unless the user
          // explicitly weighed raw (weightBasis='raw'), in which case it's the
          // pre-cooking mass and scales 1:1 against the raw DB row.
          const dbState = matchInfo?.dbState ?? 'unknown';
          const grams = ingredientGrams(ing);
          const cookingMethod = ingredientCookingMethod(decomposedItem, ing);
          const dbScalingGrams = computeDbScalingGrams({
            grams,
            dbState,
            cookingMethod,
            weightBasis: ing.weightBasis,
          });
          // Telemetry: count cooked→raw fudge invocations (skipped when the
          // user gave a raw weight).
          if (
            dbState !== 'cooked' &&
            ing.weightBasis !== 'raw' &&
            dbScalingGrams !== grams
          ) {
            cookedToRawFactorFires += 1;
          }

          const boundedNutrition = llmData
            ? mergeNutrition(
                llmData,
                matchInfo?.nutritionPer100g ?? null,
                dbScalingGrams
              )
            : nullBoundedNutrition();

          if (llmData?.ingredientId) {
            ingredientNutrition.push({
              ingredientId: llmData.ingredientId,
              matchedDbId: matchInfo?.foodCompositionId ?? null,
              caloriesKcal: normalizeBoundedEstimate(llmData.caloriesKcal),
              proteinG: normalizeBoundedEstimate(llmData.proteinG),
              carbohydrateG: normalizeBoundedEstimate(llmData.carbohydrateG),
              fatG: normalizeBoundedEstimate(llmData.fatG),
            });
          }

          const displayedNutrition = goalAdjustNutrition(
            boundedNutrition,
            goal,
            aggression
          );

          return {
            ingredientName: ingredientDisplayName(ing),
            foodCompositionId: matchInfo?.foodCompositionId ?? null,
            foodGroupEn: matchInfo?.foodGroupEn,
            estimatedGrams: grams,
            rawEquivalentGrams: dbScalingGrams,
            cookingMethod,
            userFacingUnit: null,
            matchConfidence: matchInfo?.similarity ?? null,
            boundedNutrition,
            displayedNutrition,
          };
        }
      );

      return {
        name: decomposedItem.name,
        ingredients,
        boundedNutrition: sumBoundedNutrition(
          ingredients.map((i) => i.boundedNutrition)
        ),
        displayedNutrition: sumDisplayedNutrition(
          ingredients.map((i) => i.displayedNutrition)
        ),
      };
    }
  );

  const allIngredients = pipelineMealItems.flatMap((mi) => mi.ingredients);

  return {
    result: {
      mealItems: pipelineMealItems,
      mealSlot: decomposition.mealSlot,
      confidenceOverall: computeOverallConfidence(matched, unmatched),
      boundedNutrition: sumBoundedNutrition(
        allIngredients.map((i) => i.boundedNutrition)
      ),
      displayedNutrition: sumDisplayedNutrition(
        allIngredients.map((i) => i.displayedNutrition)
      ),
      unmatchedIngredients: unmatched,
    },
    metrics: { cookedToRawFactorFires },
    ingredientNutrition,
  };
}
