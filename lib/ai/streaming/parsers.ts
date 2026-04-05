import type { Goal } from '@/lib/onboarding/types';
import type { MacroBreakdown, MealItem } from '@/lib/types/meal';
import { GOAL_BOUND_DIRECTION } from '../constants';
import type {
  BoundedEstimate,
  GoalAdjustedNutrient,
  MealItemNutrition,
} from '../types';

// ---------------------------------------------------------------------------
// Call 1: Extract meal item names from partial decomposition JSON
// ---------------------------------------------------------------------------

/**
 * Regex to detect meal item names in streaming decomposition JSON.
 * Meal item names are ALWAYS followed by `,"ingredients":` in the schema,
 * unlike ingredient names which are followed by `,"estimatedGrams":`.
 *
 * Hoisted outside the function per js-hoist-regexp rule.
 */
const MEAL_ITEM_NAME_RE = /"name"\s*:\s*"([^"]+)"\s*,\s*"ingredients"\s*:/g;

/**
 * Extract meal item names from a partial decomposition JSON stream.
 * Only returns newly discovered names (tracked via `seen` set).
 */
export function extractMealItemNames(
  accumulated: string,
  seen: Set<string>
): string[] {
  const newNames: string[] = [];
  MEAL_ITEM_NAME_RE.lastIndex = 0;
  let match = MEAL_ITEM_NAME_RE.exec(accumulated);
  while (match !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      newNames.push(name);
    }
    match = MEAL_ITEM_NAME_RE.exec(accumulated);
  }
  return newNames;
}

// ---------------------------------------------------------------------------
// Call 2: Extract completed meal item nutrition from partial estimation JSON
// ---------------------------------------------------------------------------

/**
 * Regex to find the start of each meal item object in the nutrition JSON.
 * Each `{"mealItemName":"..."}` marks the boundary of a new meal item.
 */
const MEAL_ITEM_START_RE = /\{\s*"mealItemName"\s*:\s*"/g;

/**
 * Extract completed meal items from partial nutrition estimation JSON.
 *
 * A meal item is considered "complete" when the NEXT `{"mealItemName":`
 * appears in the stream (meaning the previous item's JSON is fully generated).
 *
 * Returns only newly completed items (skips items already extracted).
 */
export function extractCompletedMealItemNutrition(
  accumulated: string,
  lastExtractedCount: number
): { items: MealItemNutrition[]; newCount: number } {
  // Find all meal item object start positions
  MEAL_ITEM_START_RE.lastIndex = 0;
  const positions: number[] = [];
  let match = MEAL_ITEM_START_RE.exec(accumulated);
  while (match !== null) {
    positions.push(match.index);
    match = MEAL_ITEM_START_RE.exec(accumulated);
  }

  // Need at least 2 positions: the Nth item is only confirmed complete
  // when the (N+1)th item's start marker appears
  const completedCount = Math.max(0, positions.length - 1);

  if (completedCount <= lastExtractedCount) {
    return { items: [], newCount: lastExtractedCount };
  }

  const newItems: MealItemNutrition[] = [];

  for (let i = lastExtractedCount; i < completedCount; i++) {
    const start = positions[i];
    const end = positions[i + 1];

    // Extract the substring for this meal item object
    let itemStr = accumulated.slice(start, end).trim();

    // Remove trailing comma (separates consecutive array elements)
    if (itemStr.endsWith(',')) {
      itemStr = itemStr.slice(0, -1);
    }

    try {
      const parsed = JSON.parse(itemStr);
      if (parsed.mealItemName && Array.isArray(parsed.ingredients)) {
        newItems.push(parsed as MealItemNutrition);
      }
    } catch {
      // Partial/malformed JSON — skip this item
    }
  }

  return { items: newItems, newCount: completedCount };
}

// ---------------------------------------------------------------------------
// Goal-adjusted macro computation for streaming
// ---------------------------------------------------------------------------

/**
 * Apply goal adjustment to a single bounded estimate.
 * Formula: mid + aggression × (goalBound - mid)
 */
function goalAdjustMacro(
  estimate: BoundedEstimate,
  goal: Goal,
  aggression: number,
  nutrient: GoalAdjustedNutrient
): number {
  if (aggression === 0) return estimate.mid;
  const direction = GOAL_BOUND_DIRECTION[goal][nutrient];
  const goalBound = direction === 'high' ? estimate.high : estimate.low;
  return estimate.mid + aggression * (goalBound - estimate.mid);
}

/**
 * Compute a display-ready MealItem from a streamed MealItemNutrition.
 * Sums ingredient macros with goal adjustment applied.
 *
 * @param nutrition - Parsed nutrition data for one meal item from Call 2
 * @param quantity - Total grams for this meal item (from decomposition)
 * @param index - 0-based index of this meal item
 * @param goal - User's fitness goal
 * @param aggression - Goal aggression factor (0-0.8)
 */
export function computeStreamingMealItem(
  nutrition: MealItemNutrition,
  quantity: number,
  index: number,
  goal: Goal,
  aggression: number
): MealItem {
  const macros: MacroBreakdown = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const ing of nutrition.ingredients) {
    macros.calories += goalAdjustMacro(
      ing.caloriesKcal,
      goal,
      aggression,
      'caloriesKcal'
    );
    macros.protein += goalAdjustMacro(
      ing.proteinG,
      goal,
      aggression,
      'proteinG'
    );
    macros.carbs += goalAdjustMacro(
      ing.carbohydrateG,
      goal,
      aggression,
      'carbohydrateG'
    );
    macros.fat += goalAdjustMacro(ing.fatG, goal, aggression, 'fatG');
  }

  return {
    id: `item-${index + 1}`,
    name: nutrition.mealItemName,
    quantity,
    unit: 'g',
    macros: {
      calories: Math.round(macros.calories),
      protein: Math.round(macros.protein),
      carbs: Math.round(macros.carbs),
      fat: Math.round(macros.fat),
    },
  };
}
