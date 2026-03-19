import {
  convertCookedToRaw,
  GOAL_ADJUSTED_NUTRIENTS,
  NUTRITION_KEYS,
} from '../constants';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from '../goal-adjustment';
import { normalizeBoundedEstimate } from '../schemas';
import type {
  BoundedEstimate,
  BoundedNutrition,
  IngredientLlmNutrition,
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

/**
 * D5: Merge LLM's 5 bounded nutrients with DB mid values for remaining 23.
 * The LLM only estimates calories, protein, carbs, fat, fiber.
 * All other nutrients use the DB per-100g value scaled to portion, as {low=mid=high=val}.
 *
 * D2: Apply normalizeBoundedEstimate to re-sort any ordering violations.
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
): PipelineResult {
  const { goal, aggression } = userContext;
  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  // Flatten all Step 3 ingredients into a single map keyed by ingredientName::mealItemName.
  // Composite key prevents last-write-wins when the same ingredient appears in multiple meal items.
  const llmNutritionByKey = new Map<string, IngredientLlmNutrition>();
  for (const mi of nutrition.mealItems) {
    for (const ing of mi.ingredients) {
      llmNutritionByKey.set(`${ing.ingredientName}::${mi.mealItemName}`, ing);
    }
  }

  const pipelineMealItems: PipelineMealItem[] = decomposition.mealItems.map(
    (decomposedItem) => {
      const ingredients: ProcessedIngredient[] = decomposedItem.ingredients.map(
        (ing) => {
          const matchInfo = matchedLookup.get(ing.name);
          const llmData = llmNutritionByKey.get(
            `${ing.name}::${decomposedItem.name}`
          );

          // estimatedGrams is the cooked/as-eaten weight (user-facing).
          // rawEquivalentGrams is used for DB nutrition scaling only.
          const rawEquivalentGrams = convertCookedToRaw(
            ing.estimatedGrams,
            ing.cookingMethod
          );

          const boundedNutrition = llmData
            ? mergeNutrition(
                llmData,
                matchInfo?.nutritionPer100g ?? null,
                rawEquivalentGrams
              )
            : nullBoundedNutrition();

          const displayedNutrition = goalAdjustNutrition(
            boundedNutrition,
            goal,
            aggression
          );

          return {
            ingredientName: ing.name,
            foodCompositionId: matchInfo?.foodCompositionId ?? null,
            estimatedGrams: ing.estimatedGrams,
            rawEquivalentGrams,
            cookingMethod: ing.cookingMethod,
            userFacingUnit: ing.userFacingUnit,
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
  };
}
