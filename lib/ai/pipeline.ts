import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { GeminiClient } from './gemini';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from './goal-adjustment';
import { matchIngredients } from './ingredient-matching';
import { buildDecompositionPrompt, buildNutritionPrompt } from './prompts';
import {
  mealDecompositionSchema,
  normalizeBoundedEstimate,
  nutritionAdjustmentSchema,
} from './schemas';
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
  PipelineResponse,
  PipelineResult,
  ProcessedIngredient,
  UnmatchedIngredient,
  UserContext,
} from './types';
import { LLM_BOUNDED_NUTRIENTS, NUTRITION_KEYS } from './types';

/** D1/D8: Default model for both LLM calls, configurable per call */
const GEMINI_MODEL = 'gemini-3.0-flash';

/**
 * D6 Layer 2: Vietnamese-first blocklist of non-food syntactic markers.
 * If the LLM decomposes something but an ingredient name is entirely
 * one of these, it's likely a non-food misparse.
 */
const NON_FOOD_BLOCKLIST = new Set([
  // Vietnamese pronouns
  'tôi',
  'mình',
  'bạn',
  'anh',
  'chị',
  'em',
  'nó',
  'họ',
  // Vietnamese sentiment/state verbs
  'vui',
  'buồn',
  'mệt',
  'khỏe',
  'đói',
  'no',
  // Conjunctions/fillers as standalone
  'và',
  'hoặc',
  'nhưng',
  'vì',
  'nên',
  'thì',
]);

/**
 * Full meal analysis pipeline.
 *
 * Flow: LLM decomposition → ingredient matching → LLM nutrition → goal adjustment → aggregation.
 *
 * Error handling (D4):
 * - non_food_input: returned immediately, no retry (isFood=false or blocklist)
 * - parse_error: one retry (LLMs are non-deterministic), then surface
 * - api_error: one retry, then surface
 */
export async function analyzeMeal(
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<PipelineResponse> {
  try {
    return await runPipeline(rawInput, userContext, db, gemini);
  } catch (error) {
    // D4: Non-food input errors are not retryable
    if (isNonFoodError(error)) {
      return {
        success: false,
        error: {
          type: 'non_food_input',
          message:
            "We didn't recognize this as a meal description. Could you try describing what you ate differently?",
          retryable: false,
        },
      };
    }

    // D4: Parse errors get one retry (LLMs are non-deterministic)
    // API/network errors also get one retry
    try {
      return await runPipeline(rawInput, userContext, db, gemini);
    } catch (retryError) {
      return handleError(retryError);
    }
  }
}

/**
 * Check if error indicates non-food input (not retryable).
 * This is a specific sentinel thrown by our pipeline, not a generic parse error.
 */
function isNonFoodError(error: unknown): boolean {
  return error instanceof NonFoodError;
}

class NonFoodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonFoodError';
  }
}

async function runPipeline(
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<PipelineResponse> {
  // Step 1: LLM Call 1 — Decompose meal
  const decomposition = await decomposeMeal(rawInput, userContext, gemini);

  // D6 Layer 1: Check isFood field from LLM
  if (!decomposition.isFood) {
    throw new NonFoodError('Input is not food');
  }

  // D6 Layer 2: Post-parse blocklist sanity check
  for (const mi of decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      const normalized = ing.name.toLowerCase().trim();
      if (NON_FOOD_BLOCKLIST.has(normalized)) {
        throw new NonFoodError(`Non-food ingredient detected: "${ing.name}"`);
      }
    }
  }

  // Step 2: Ingredient matching — fuzzy → vector → unmatched cascade
  const allIngredients = decomposition.mealItems.flatMap(
    (mi) => mi.ingredients
  );
  const matchResult = await matchIngredients(
    allIngredients,
    rawInput,
    db,
    gemini
  );

  // Step 3: LLM Call 2 — Cooking-adjusted bounded nutrition (5 key nutrients)
  const nutritionResult = await adjustNutrition(
    decomposition.mealItems,
    matchResult.matched,
    matchResult.unmatched,
    userContext,
    gemini
  );

  // Step 4: Assemble results — merge LLM's 5 nutrients with DB's 23, goal adjust
  const pipelineResult = assembleResult(
    decomposition,
    nutritionResult,
    matchResult.matched,
    matchResult.unmatched,
    userContext
  );

  return { success: true, data: pipelineResult };
}

async function decomposeMeal(
  rawInput: string,
  userContext: UserContext,
  gemini: GeminiClient
): Promise<MealDecomposition> {
  const systemPrompt = buildDecompositionPrompt(userContext);

  return gemini.generateStructuredOutput({
    schema: mealDecompositionSchema,
    systemPrompt,
    userMessage: rawInput,
    model: GEMINI_MODEL,
  });
}

async function adjustNutrition(
  mealItems: MealDecomposition['mealItems'],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext,
  gemini: GeminiClient
): Promise<NutritionAdjustment> {
  const systemPrompt = buildNutritionPrompt(
    mealItems,
    matched,
    unmatched,
    userContext
  );

  return gemini.generateStructuredOutput({
    schema: nutritionAdjustmentSchema,
    systemPrompt,
    userMessage:
      'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
    model: GEMINI_MODEL,
  });
}

// ---------------------------------------------------------------------------
// Assembly: merge LLM's 5 nutrients with DB mid values for remaining 23
// ---------------------------------------------------------------------------

/**
 * D5: Merge LLM's 5 bounded nutrients with DB mid values for remaining 23.
 * The LLM only estimates calories, protein, carbs, fat, fiber.
 * All other nutrients use the DB per-100g value scaled to portion, as {low=mid=high=val}.
 *
 * D2: Apply normalizeBoundedEstimate to re-sort any ordering violations.
 */
function mergeNutrition(
  llmNutrition: IngredientLlmNutrition,
  dbNutrition: NutritionValues | null,
  estimatedGrams: number
): BoundedNutrition {
  const result = {} as Record<string, BoundedEstimate | null>;
  const llmKeys = new Set<string>(LLM_BOUNDED_NUTRIENTS);

  for (const key of NUTRITION_KEYS) {
    if (llmKeys.has(key)) {
      // Use LLM's bounded estimate (D2: normalize ordering)
      const raw = llmNutrition[key as keyof IngredientLlmNutrition];
      if (raw != null && typeof raw === 'object' && 'mid' in raw) {
        result[key] = normalizeBoundedEstimate(raw as BoundedEstimate);
      } else {
        result[key] = null;
      }
    } else {
      // D5: Use DB mid value scaled to portion, as flat bounded estimate
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

function assembleResult(
  decomposition: MealDecomposition,
  nutrition: NutritionAdjustment,
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext
): PipelineResult {
  const { goal, aggression } = userContext;
  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  // Build LLM nutrition lookup: mealItemName → ingredientName → IngredientLlmNutrition
  const llmNutritionLookup = new Map<
    string,
    Map<string, IngredientLlmNutrition>
  >();
  for (const mi of nutrition.mealItems) {
    const ingredientMap = new Map<string, IngredientLlmNutrition>();
    for (const ing of mi.ingredients) {
      ingredientMap.set(ing.ingredientName, ing);
    }
    llmNutritionLookup.set(mi.mealItemName, ingredientMap);
  }

  const pipelineMealItems: PipelineMealItem[] = [];
  const allIngredientBounded: BoundedNutrition[] = [];
  const allIngredientDisplayed: NutritionValues[] = [];

  for (const decomposedItem of decomposition.mealItems) {
    const itemLlmMap = llmNutritionLookup.get(decomposedItem.name);
    const processedIngredients: ProcessedIngredient[] = [];

    for (const ing of decomposedItem.ingredients) {
      const matchInfo = matchedLookup.get(ing.name);
      const llmData = itemLlmMap?.get(ing.name);

      // D5: Merge LLM's 5 nutrients with DB's remaining 23
      const boundedNutrition = llmData
        ? mergeNutrition(
            llmData,
            matchInfo?.nutritionPer100g ?? null,
            ing.estimatedGrams
          )
        : nullBoundedNutrition();

      const displayedNutrition = goalAdjustNutrition(
        boundedNutrition,
        goal,
        aggression
      );

      processedIngredients.push({
        ingredientName: ing.name,
        foodCompositionId: matchInfo?.foodCompositionId ?? null,
        estimatedGrams: ing.estimatedGrams,
        cookingMethod: ing.cookingMethod,
        userFacingUnit: ing.userFacingUnit,
        matchConfidence: matchInfo?.similarity ?? null,
        boundedNutrition,
        displayedNutrition,
      });

      allIngredientBounded.push(boundedNutrition);
      allIngredientDisplayed.push(displayedNutrition);
    }

    const itemBounded = sumBoundedNutrition(
      processedIngredients.map((i) => i.boundedNutrition)
    );
    const itemDisplayed = sumDisplayedNutrition(
      processedIngredients.map((i) => i.displayedNutrition)
    );

    pipelineMealItems.push({
      name: decomposedItem.name,
      ingredients: processedIngredients,
      boundedNutrition: itemBounded,
      displayedNutrition: itemDisplayed,
    });
  }

  const mealBounded = sumBoundedNutrition(allIngredientBounded);
  const mealDisplayed = sumDisplayedNutrition(allIngredientDisplayed);
  const confidenceOverall = computeOverallConfidence(matched, unmatched);

  return {
    mealItems: pipelineMealItems,
    mealSlot: decomposition.mealSlot,
    confidenceOverall,
    boundedNutrition: mealBounded,
    displayedNutrition: mealDisplayed,
    unmatchedIngredients: unmatched,
  };
}

function computeOverallConfidence(
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

  // If any ingredient is unmatched, cap at 'medium' (never upgrade)
  if (unmatched.length > 0 && lowest > 2) {
    lowest = 2;
  }

  if (lowest >= 3) return 'high';
  if (lowest >= 2) return 'medium';
  return 'low';
}

function nullBoundedNutrition(): BoundedNutrition {
  const result = {} as Record<string, null>;
  for (const key of NUTRITION_KEYS) {
    result[key] = null;
  }
  return result as unknown as BoundedNutrition;
}

function handleError(error: unknown): PipelineResponse {
  if (isNonFoodError(error)) {
    return {
      success: false,
      error: {
        type: 'non_food_input',
        message:
          "We didn't recognize this as a meal description. Could you try describing what you ate differently?",
        retryable: false,
      },
    };
  }

  // D4: Distinguish parse errors from API errors
  const message = error instanceof Error ? error.message : String(error);
  const isParse =
    message.includes('parse') ||
    message.includes('Zod') ||
    message.includes('JSON');

  if (isParse) {
    return {
      success: false,
      error: {
        type: 'parse_error',
        message:
          'We had trouble understanding the AI response. Please try again.',
        retryable: true,
      },
    };
  }

  return {
    success: false,
    error: {
      type: 'api_error',
      message: 'Something went wrong analyzing your meal. Please try again.',
      retryable: true,
    },
  };
}
