import {
  convertCookedToRaw,
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
} from '../types';
import { buildPromptContextLine } from './sanitize';
import type { PromptPersonalizationContext } from './types';

/**
 * Principle A (spec §2): the LLM produces honest physical-world estimates
 * conditioned only on the meal text and the user's cooking identity (country
 * of origin/residence, cookingHabits). Goal, aggression, and calorie targets
 * NEVER reach this prompt — TypeScript enforces the boundary via
 * PromptPersonalizationContext.
 *
 * Spec: docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */

/**
 * Build the system prompt for LLM Call 2 (cooking-adjusted bounded nutrition).
 *
 * V2: Compressed instructions, no hardcoded % — LLM decides bounds.
 * Dynamic XML data sections kept verbatim.
 *
 * Note: estimatedGrams from Step 1 are COOKED weights. We convert to raw here
 * before passing to the LLM, since DB values are per 100g RAW.
 */

/**
 * Collator for deterministic Vietnamese ingredient ordering.
 * Sorting matched ingredients before building the prompt XML stabilizes
 * Gemini's prompt cache prefix for repeated similar inputs.
 */
const viCollator = new Intl.Collator('vi', { sensitivity: 'base' });

export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext
): string {
  const { cookingHabits } = userContext;
  const countryLines = [
    buildPromptContextLine('country_of_origin', userContext.countryOfOrigin),
    buildPromptContextLine(
      'country_of_residence',
      userContext.countryOfResidence
    ),
  ].filter((line): line is string => line !== null);

  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  // Sort meal items and their ingredients for a deterministic prompt order.
  // Same ingredient set → identical XML → Gemini prompt cache hit.
  const sortedMealItems = [...mealItems]
    .sort((a, b) => {
      const nameOrder = viCollator.compare(a.name, b.name);
      if (nameOrder !== 0) return nameOrder;
      // Tie-breaker: compare sorted ingredient names for fully deterministic ordering.
      // Prevents same meal-item names with different ingredient sets from producing
      // different XML across permuted inputs (breaks Gemini prompt cache prefix).
      const aKey = [...a.ingredients]
        .map((i) => i.name)
        .sort()
        .join('\0');
      const bKey = [...b.ingredients]
        .map((i) => i.name)
        .sort()
        .join('\0');
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    })
    .map((item) => ({
      ...item,
      ingredients: [...item.ingredients].sort((a, b) =>
        viCollator.compare(a.name, b.name)
      ),
    }));

  let ingredientData = '<ingredient_data>\n';
  ingredientData +=
    '  <!-- DB values are per 100g RAW uncooked weight. estimatedGrams is also RAW. -->\n\n';

  for (const mealItem of sortedMealItems) {
    ingredientData += `  <meal_item name="${mealItem.name}">\n`;

    for (const ing of mealItem.ingredients) {
      const match = matchedLookup.get(ing.name);
      if (match) {
        const rawGrams = convertCookedToRaw(
          ing.estimatedGrams,
          ing.cookingMethod
        );
        ingredientData += `    <ingredient name="${ing.name}" source="db_matched" db_name="${match.matchedName}" raw_grams="${rawGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''}>\n`;
        ingredientData += `      <per_100g_raw calories="${match.nutritionPer100g.caloriesKcal ?? '?'}" protein="${match.nutritionPer100g.proteinG ?? '?'}g" carbs="${match.nutritionPer100g.carbohydrateG ?? '?'}g" fat="${match.nutritionPer100g.fatG ?? '?'}g" />\n`;
        ingredientData += `    </ingredient>\n`;
      }
    }
    ingredientData += `  </meal_item>\n`;
  }
  ingredientData += '</ingredient_data>\n';

  let unmatchedSection = '';
  if (unmatched.length > 0) {
    const unmatchedNames = new Set(unmatched.map((u) => u.ingredientName));
    unmatchedSection = '\n<unmatched_ingredients>\n';
    unmatchedSection +=
      '  <!-- No DB match found. Use your knowledge of Vietnamese cuisine for these. -->\n';

    for (const mealItem of sortedMealItems) {
      const unmatchedIngs = mealItem.ingredients.filter((ing) =>
        unmatchedNames.has(ing.name)
      );
      if (unmatchedIngs.length > 0) {
        unmatchedSection += `  <meal_item name="${mealItem.name}">\n`;
        for (const ing of unmatchedIngs) {
          const rawGrams = convertCookedToRaw(
            ing.estimatedGrams,
            ing.cookingMethod
          );
          unmatchedSection += `    <ingredient name="${ing.name}" raw_grams="${rawGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''} />\n`;
        }
        unmatchedSection += `  </meal_item>\n`;
      }
    }

    unmatchedSection += '</unmatched_ingredients>\n';
  }

  return `You are a Vietnamese cuisine nutrition expert. Produce cooking-adjusted, bounded nutrition estimates.

<instructions>
  <task>
    For each ingredient in each meal item, produce LOW/MID/HIGH for 4 macros: caloriesKcal, proteinG, carbohydrateG, fatG.
  </task>

  <calculation>
    1. Scale: base = (estimatedGrams / 100) × per_100g_raw. All values are RAW weights.
    2. Adjust for cooking method: each ingredient has a "cooking" attribute — use your knowledge of
       how that cooking method affects macros (e.g., fat absorption in frying, nutrient loss in boiling).
    3. MID = your best estimate after cooking adjustment.
  </calculation>

  <why_three_values>
    Each macro is a triple LOW/MID/HIGH expressing genuine uncertainty about
    the user's actual portion and cooking behavior — not a preference signal.
    - MID: your best point estimate after cooking adjustment.
    - LOW:  conservative lower bound. Tighten when the ingredient is well-known
            and DB-matched. Widen when you are guessing (unknown oil quantity,
            ambiguous portion size, unmatched ingredient).
    - HIGH: conservative upper bound. Same widening rules.
    These bounds are physical-world uncertainty bounds. Downstream
    deterministic code applies any preference-shaped adjustment.
  </why_three_values>

  <unmatched_rule>
    For ingredients in <unmatched_ingredients>: use your Vietnamese food knowledge to estimate.
    Use wider bounds since we have no DB reference.

    IMPORTANT: Each unmatched ingredient is nested under its parent <meal_item>.
    You MUST use the meal item name as primary context — same ingredient differs by dish:
    - "nước dùng" in "canh rau lang tôm" → light broth ~5–8 kcal/100ml
    - "nước dùng" in "bún bò Huế" → rich bone broth ~30–50 kcal/100ml
  </unmatched_rule>
</instructions>

<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  oil_usage: ${cookingHabits.oilUsage}
  sugar_braised: ${cookingHabits.sugarBraised}
  default_rice_portion: ${RICE_PORTION_DESCRIPTION[cookingHabits.defaultRicePortion]}
  default_protein_portion: ${PROTEIN_PORTION_DESCRIPTION[cookingHabits.defaultProteinPortion]}
  broth_consumption: ${cookingHabits.brothConsumption}
</user_context>

<example>
  gạo tẻ, 65g raw, nấu, DB: 352 kcal/100g → base=(65/100)×352=229 kcal.
  nấu: no macro change. MID≈229. LOW≈210 (tighter, DB-matched). HIGH≈250.
  → {"ingredientName":"gạo tẻ","caloriesKcal":{"low":210,"mid":229,"high":250},...}
</example>

${ingredientData}
${unmatchedSection}

<output_format>
  Return JSON: top-level "mealItems" array. Each has "mealItemName" + "ingredients" array.
  Each ingredient: "ingredientName" + 4 nutrients {low, mid, high}. Match names from decomposition exactly.
  Round to 1 decimal place.
</output_format>`;
}
