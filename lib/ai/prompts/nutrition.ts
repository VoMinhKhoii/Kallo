import {
  convertCookedToRaw,
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '../types';

/**
 * Build the system prompt for LLM Call 2 (cooking-adjusted bounded nutrition).
 *
 * V2: Compressed instructions, concise cooking adjustment table.
 * Dynamic XML data sections kept verbatim.
 *
 * Note: estimatedGrams from Step 1 are COOKED weights. We convert to raw here
 * before passing to the LLM, since DB values are per 100g RAW.
 */

export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext
): string {
  const { cookingHabits } = userContext;

  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  // Collect cooking methods in use for dynamic prompt trimming
  const usedMethods = new Set<string | null>();
  for (const mi of mealItems) {
    for (const ing of mi.ingredients) {
      usedMethods.add(ing.cookingMethod);
    }
  }

  // Build dynamic cooking adjustment table (only used methods)
  const allAdjustments: Record<string, string> = {
    kho: 'kho: carbs +10–20% (sugar/caramel), fat +5–10% (oil)',
    'chiên/xào': 'chiên/xào: fat +15–30% (absorbed oil)',
    luộc: 'luộc: calories −5% (nutrient loss to water)',
    nướng: 'nướng: fat −5–10% (drip loss)',
    hấp: 'hấp: no change',
    nấu: 'nấu (rice): no macro change (water absorption only)',
  };

  const cookingLines: string[] = [];
  for (const [key, line] of Object.entries(allAdjustments)) {
    // Include if any method matches (chiên/xào matches either chiên or xào)
    const methodKeys = key.split('/');
    if (methodKeys.some((k) => usedMethods.has(k))) {
      cookingLines.push(`       ${line}`);
    }
  }
  // Always include null/raw fallback
  cookingLines.push('       null/raw: use base directly');

  const cookingTable = cookingLines.join('\n');

  let ingredientData = '<ingredient_data>\n';
  ingredientData +=
    '  <!-- DB values are per 100g RAW uncooked weight. estimatedGrams is also RAW. -->\n\n';

  for (const mealItem of mealItems) {
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

    for (const mealItem of mealItems) {
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
    2. Adjust for cooking method:
${cookingTable}
    3. Bound: MID = adjusted base. LOW = MID −10–15%. HIGH = MID +15–25%.
       Widen HIGH for: heavy oil_usage (+5% fat on fried), high sugar_braised (+5% carbs on kho),
       finish_it broth_consumption (full broth calories in MID/HIGH for soups).
  </calculation>

  <unmatched_rule>
    For ingredients in <unmatched_ingredients>: use fallback estimation from Vietnamese food knowledge,
    then apply same calculation. Widen bounds: LOW −15%, HIGH +25%.

    IMPORTANT: Each unmatched ingredient is nested under its parent <meal_item>.
    You MUST use the meal item name as primary context — same ingredient differs by dish:
    - "nước dùng" in "canh rau lang tôm" → light broth ~5–8 kcal/100ml
    - "nước dùng" in "bún bò Huế" → rich bone broth ~30–50 kcal/100ml
  </unmatched_rule>
</instructions>

<user_context>
  oil_usage: ${cookingHabits.oilUsage}
  sugar_braised: ${cookingHabits.sugarBraised}
  default_rice_portion: ${RICE_PORTION_DESCRIPTION[cookingHabits.defaultRicePortion]}
  default_protein_portion: ${PROTEIN_PORTION_DESCRIPTION[cookingHabits.defaultProteinPortion]}
  broth_consumption: ${cookingHabits.brothConsumption}
</user_context>

<example>
  gạo tẻ, 65g raw, nấu, DB: 352 kcal/100g → base=(65/100)×352=229 kcal.
  nấu: no macro change. MID≈229. LOW=229×0.89≈204. HIGH=229×1.15≈263.
  → {"ingredientName":"gạo tẻ","caloriesKcal":{"low":204,"mid":229,"high":263},...}
</example>

${ingredientData}
${unmatchedSection}

<output_format>
  Return JSON: top-level "mealItems" array. Each has "mealItemName" + "ingredients" array.
  Each ingredient: "ingredientName" + 4 nutrients {low, mid, high}. Match names from decomposition exactly.
  Round to 1 decimal place.
</output_format>`;
}
