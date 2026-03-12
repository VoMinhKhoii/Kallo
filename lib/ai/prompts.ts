import type { Goal } from '@/lib/onboarding/types';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from './types';

// ---------------------------------------------------------------------------
// LLM Call 1: Meal decomposition prompt
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for LLM Call 1 (meal decomposition).
 * Injects user's regional profile and cooking habits as prior context
 * for resolving ambiguous inputs.
 */
export function buildDecompositionPrompt(userContext: UserContext): string {
  const { regionalProfile, cookingHabits } = userContext;

  return `You are a Vietnamese cuisine expert. Given a natural-language meal description, decompose it into structured data.

## Your task
1. Determine if the input describes food. Set isFood to true if it does, false if it doesn't.
2. If isFood is true: break the meal into user-facing meal items (what a person would see as distinct items on their plate/tray).
3. For each meal item, list the raw ingredients with estimated weights in grams.
4. Classify the meal slot (breakfast/brunch/lunch/dinner/snack) if you can tell from context. Set mealSlot to null if uncertain.

## isFood classification
- Set isFood=true for any description of food, meals, dishes, ingredients, or eating.
- Set isFood=false for greetings, questions, non-food items, random text, or anything not about food.
- When isFood=false, return empty mealItems array and null mealSlot.

## Decomposition rules
- Meal items are user-visible: "bún bò Huế", "cơm", "canh chua". NOT raw ingredients.
- Ingredients are internal breakdown: rice vermicelli, beef, broth, etc.
- estimatedGrams should reflect a typical Vietnamese serving for the described portion.
- cookingMethod: identify if mentioned or inferable (luộc, chiên, kho, nướng, xào, hấp, etc.), otherwise null.
- userFacingUnit: preserve the original unit from user input (e.g., "1 chén", "2 miếng", "1 tô") for display, null if not specified.

## User's cooking context (use as priors for ambiguous inputs)
- regional_profile: ${regionalProfile}
- oil_usage: ${cookingHabits.oilUsage}
- default_rice_portion: ${cookingHabits.defaultRicePortion}
- sugar_braised: ${cookingHabits.sugarBraised}
- default_protein_portion: ${cookingHabits.defaultProteinPortion}
- broth_consumption: ${cookingHabits.brothConsumption}

## Regional cooking notes
- mien_bac (Northern): lighter seasoning, less sugar, balanced flavors
- mien_trung (Central): spicy, fermented flavors, moderate portions
- mien_nam (Southern): sweeter braised dishes, coconut milk, generous portions
- mien_tay (Western/Mekong): heavy oil, sweet, large portions, river fish

When the input is ambiguous (e.g., "thịt kho" without specifying protein), use the regional profile to choose the most common interpretation.

## Output format
Return JSON matching the provided schema. Every meal item must have at least one ingredient. Use Vietnamese ingredient names.`;
}

// ---------------------------------------------------------------------------
// LLM Call 2: Nutrition adjustment prompt
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for LLM Call 2 (cooking-adjusted bounded nutrition).
 * Provides DB nutrition values per 100g for matched ingredients,
 * lists unmatched ingredients for LLM fallback estimates.
 *
 * D5: Only asks for 5 key nutrients (calories, protein, carbs, fat, fiber).
 */
export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext
): string {
  const { cookingHabits } = userContext;

  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  let ingredientData =
    '## Ingredient reference data (per 100g, from Vietnamese food composition DB)\n\n';

  for (const mealItem of mealItems) {
    ingredientData += `### ${mealItem.name}\n`;

    for (const ing of mealItem.ingredients) {
      const match = matchedLookup.get(ing.name);
      if (match) {
        ingredientData += `- **${ing.name}** (matched: "${match.matchedName}", ${ing.estimatedGrams}g${ing.cookingMethod ? `, ${ing.cookingMethod}` : ''}):\n`;
        ingredientData += `  calories: ${match.nutritionPer100g.caloriesKcal ?? '?'} kcal, `;
        ingredientData += `protein: ${match.nutritionPer100g.proteinG ?? '?'}g, `;
        ingredientData += `carbs: ${match.nutritionPer100g.carbohydrateG ?? '?'}g, `;
        ingredientData += `fat: ${match.nutritionPer100g.fatG ?? '?'}g, `;
        ingredientData += `fiber: ${match.nutritionPer100g.fiberG ?? '?'}g\n`;
      }
    }
  }

  let unmatchedSection = '';
  if (unmatched.length > 0) {
    unmatchedSection =
      '\n## Unmatched ingredients (no DB match — provide fallback estimates from your knowledge)\n\n';
    for (const u of unmatched) {
      const ing = mealItems
        .flatMap((mi) => mi.ingredients)
        .find((i) => i.name === u.ingredientName);

      unmatchedSection += `- **${u.ingredientName}** (${ing?.estimatedGrams ?? '?'}g${ing?.cookingMethod ? `, ${ing.cookingMethod}` : ''}): No match in DB. Estimate from your knowledge of Vietnamese cuisine.\n`;
    }
  }

  return `You are a Vietnamese cuisine nutrition expert. Given ingredient reference data from a food composition database, produce cooking-adjusted bounded nutrition estimates.

## Your task
For each ingredient in each meal item, produce low/mid/high bounded estimates for 5 key nutrients:
- caloriesKcal (kcal)
- proteinG (grams)
- carbohydrateG (grams)
- fatG (grams)
- fiberG (grams, or null if no data)

## How to calculate
1. Start with the DB nutrition per 100g values provided below.
2. Scale to the estimated portion weight (estimatedGrams).
3. Adjust for cooking method:
   - Frying (chiên/xào): +15-30% fat from cooking oil
   - Braising (kho): sugar/sodium increase based on recipe
   - Boiling (luộc): minimal change, slight nutrient loss to water
   - Raw: use DB values directly
4. Produce LOW (conservative lower), MID (most likely), HIGH (conservative upper) bounds.
   - LOW: minimal portions, lean preparation
   - MID: typical Vietnamese serving with standard preparation
   - HIGH: generous portions, richer preparation

## User's cooking context
- oil_usage: ${cookingHabits.oilUsage}
- sugar_braised: ${cookingHabits.sugarBraised}
- default_rice_portion: ${cookingHabits.defaultRicePortion}
- default_protein_portion: ${cookingHabits.defaultProteinPortion}
- broth_consumption: ${cookingHabits.brothConsumption}

Adjust bounds based on these habits:
- heavy oil_usage → wider fat range, higher mid/high fat estimates
- high sugar_braised → higher carb bounds for braised dishes
- finish_it broth_consumption → include full broth nutrition in estimates

${ingredientData}
${unmatchedSection}

## Output format
Return JSON matching the provided schema. Each ingredientName must match exactly the name from the decomposition.`;
}

// ---------------------------------------------------------------------------
// Static assumption text (Phase 3 — English only)
// ---------------------------------------------------------------------------

export interface AssumptionContent {
  heading: string;
  bullets: string[];
}

/**
 * Static assumption text per goal for the "?" tooltip.
 * Phase 3: one block per goal, English only.
 * Designed to accept dynamic per-meal content in a future phase.
 */
export const ASSUMPTION_TEXT: Record<Goal, AssumptionContent> = {
  cutting: {
    heading: 'How we estimate for your cut',
    bullets: [
      'Calorie and fat estimates lean toward the higher end to keep you safely in deficit.',
      'Protein estimates lean conservative so you know your minimum intake.',
      'Portions are based on your cooking profile and typical Vietnamese servings.',
      'When in doubt, we round up on calories — better to overestimate than under.',
    ],
  },
  bulking: {
    heading: 'How we estimate for your bulk',
    bullets: [
      'Calorie estimates lean toward the lower end so you hit your surplus confidently.',
      'Protein estimates lean generous to support muscle growth.',
      'Portions reflect your cooking profile and typical Vietnamese servings.',
      'When in doubt, we round down on calories — better to eat a bit more than less.',
    ],
  },
  maintaining: {
    heading: 'How we estimate your nutrition',
    bullets: [
      'All estimates use the most likely middle value for each nutrient.',
      'Portions are based on your cooking profile and typical Vietnamese servings.',
      'Cooking method adjustments account for oil, seasoning, and preparation style.',
    ],
  },
};
