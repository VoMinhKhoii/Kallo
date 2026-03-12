import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '../types';

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
