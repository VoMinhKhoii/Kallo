import type { ProteinPortion, RicePortion } from '@/lib/onboarding/types';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '../types';

const RICE_PORTION_DESCRIPTION: Record<RicePortion, string> = {
  small: '~1 small bowl (~100g cooked rice)',
  medium: '~1–1.5 bowls (~150g cooked rice)',
  large: '~2+ bowls (~250g cooked rice)',
};

const PROTEIN_PORTION_DESCRIPTION: Record<ProteinPortion, string> = {
  small: 'smaller than palm, ~2-3 eggs (~80g cooked)',
  medium: 'about palm-sized (~120g cooked)',
  large: 'bigger than palm, e.g. a chicken thigh (~160g cooked)',
};

/**
 * Build the system prompt for LLM Call 2 (cooking-adjusted bounded nutrition).
 *
 * Prompt engineering applied:
 * - XML tags for structural clarity
 * - Few-shot example with explicit worked math (anchors raw→cooked scaling)
 * - Explicit raw-weight contract matching Call 1's output
 * - Cooking-method adjustment instructions with concrete multipliers
 * - Unmatched ingredient section clearly separated from DB-grounded section
 */
export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext
): string {
  const { cookingHabits } = userContext;

  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  let ingredientData = '<ingredient_data>\n';
  ingredientData +=
    '  <!-- DB values are per 100g RAW uncooked weight. estimatedGrams is also RAW. -->\n\n';

  for (const mealItem of mealItems) {
    ingredientData += `  <meal_item name="${mealItem.name}">\n`;

    for (const ing of mealItem.ingredients) {
      const match = matchedLookup.get(ing.name);
      if (match) {
        ingredientData += `    <ingredient name="${ing.name}" source="db_matched" db_name="${match.matchedName}" raw_grams="${ing.estimatedGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''}>\n`;
        ingredientData += `      <per_100g_raw calories="${match.nutritionPer100g.caloriesKcal ?? '?'}" protein="${match.nutritionPer100g.proteinG ?? '?'}g" carbs="${match.nutritionPer100g.carbohydrateG ?? '?'}g" fat="${match.nutritionPer100g.fatG ?? '?'}g" fiber="${match.nutritionPer100g.fiberG ?? '?'}g" />\n`;
        ingredientData += `    </ingredient>\n`;
      }
    }
    ingredientData += `  </meal_item>\n`;
  }
  ingredientData += '</ingredient_data>\n';

  let unmatchedSection = '';
  if (unmatched.length > 0) {
    unmatchedSection = '\n<unmatched_ingredients>\n';
    unmatchedSection +=
      '  <!-- No DB match found. Use your knowledge of Vietnamese cuisine for these. -->\n';
    for (const u of unmatched) {
      const ing = mealItems
        .flatMap((mi) => mi.ingredients)
        .find((i) => i.name === u.ingredientName);
      unmatchedSection += `  <ingredient name="${u.ingredientName}" raw_grams="${ing?.estimatedGrams ?? '?'}"${ing?.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''} />\n`;
    }
    unmatchedSection += '</unmatched_ingredients>\n';
  }

  return `You are a Vietnamese cuisine nutrition expert. Produce cooking-adjusted, bounded nutrition estimates for each ingredient in a meal.

<instructions>
  <task>
    For each ingredient in each meal item, produce LOW/MID/HIGH bounded estimates for 5 nutrients:
    - caloriesKcal
    - proteinG
    - carbohydrateG
    - fatG
    - fiberG (null if no data available)
  </task>

  <calculation_steps>
    Step 1 — Scale from DB values:
      All estimatedGrams values are RAW uncooked weights. DB values are also per 100g RAW.
      Base nutrition = (estimatedGrams / 100) × per_100g_raw_value

      Example: gạo tẻ, 65g raw, DB: 352 kcal / 100g raw
        base_calories = (65 / 100) × 352 = 228.8 kcal

    Step 2 — Apply cooking method adjustment to the base:
      - kho (braising): carbs +10–20% from added sugar/caramel; fat +5–10% from oil; protein unchanged
      - chiên / xào (frying/stir-fry): fat +15–30% from absorbed oil
      - luộc (boiling): calories −5% from minor nutrient loss to water; other macros unchanged
      - nướng (grilling): fat −5–10% from drip; otherwise minimal
      - hấp (steaming): no significant change from base
      - nấu (boiling rice): cooked rice weight = raw × 2.6, but nutritional total stays at raw base
      - null / raw: use base values directly

    Step 3 — Set LOW / MID / HIGH bounds:
      - MID: base after cooking adjustment, using typical Vietnamese portion and preparation
      - LOW: base −10–15% (lighter preparation, smaller portion end)
      - HIGH: base +15–25% (richer preparation, generous portion end)

      Widen the HIGH bound specifically for:
      - heavy oil_usage → +5% extra fat on HIGH for fried/stir-fried items
      - high sugar_braised → +5% extra carbs on HIGH for kho items
      - finish_it broth_consumption → include full broth calories in MID/HIGH for soup ingredients
  </calculation_steps>

  <unmatched_rule>
    For ingredients in <unmatched_ingredients>: use fallback estimation from your knowledge
    of standard Vietnamese food composition, then apply the same Steps 1–3 above.
    Treat these estimates as inherently wider — set LOW 15% below MID and HIGH 25% above MID.
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
  <input>
    Meal item: cơm trắng
    Ingredient: gạo tẻ, raw_grams=65, cooking=nấu
    DB per 100g raw: calories=352, protein=6.8g, carbs=78.2g, fat=0.5g, fiber=0.4g
    User context: oil_usage=minimal, sugar_braised=low
  </input>
  <output>
  {
    "ingredientName": "gạo tẻ",
    "mealItemName": "cơm trắng",
    "low": {
      "caloriesKcal": 204,
      "proteinG": 3.9,
      "carbohydrateG": 44.2,
      "fatG": 0.3,
      "fiberG": 0.2
    },
    "mid": {
      "caloriesKcal": 229,
      "proteinG": 4.4,
      "carbohydrateG": 50.8,
      "fatG": 0.3,
      "fiberG": 0.3
    },
    "high": {
      "caloriesKcal": 263,
      "proteinG": 5.1,
      "carbohydrateG": 58.4,
      "fatG": 0.4,
      "fiberG": 0.3
    }
  }
  </output>
  <reasoning>
    Base: (65/100) × 352 = 228.8 kcal. Cooking = nấu (boiling for rice): nutritional total
    stays at raw base (water absorption changes weight, not calories). MID ≈ 229 kcal.
    LOW = 229 × 0.89 ≈ 204 (lighter preparation, smaller end of portion range).
    HIGH = 229 × 1.15 ≈ 263 (larger end, slightly denser rice). No oil/sugar adjustment
    needed since this is plain boiled rice and oil_usage=minimal.
  </reasoning>
</example>

<example>
  <input>
    Meal item: thịt kho trứng
    Ingredient: thịt lợn ba chỉ, raw_grams=120, cooking=kho
    DB per 100g raw: calories=258, protein=16.8g, carbs=0g, fat=21.1g, fiber=0g
    User context: oil_usage=normal, sugar_braised=medium
  </input>
  <output>
  {
    "ingredientName": "thịt lợn ba chỉ",
    "mealItemName": "thịt kho trứng",
    "low": {
      "caloriesKcal": 268,
      "proteinG": 17.2,
      "carbohydrateG": 2.1,
      "fatG": 22.8,
      "fiberG": null
    },
    "mid": {
      "caloriesKcal": 318,
      "proteinG": 20.2,
      "carbohydrateG": 3.6,
      "fatG": 26.6,
      "fiberG": null
    },
    "high": {
      "caloriesKcal": 380,
      "proteinG": 21.8,
      "carbohydrateG": 5.8,
      "fatG": 32.1,
      "fiberG": null
    }
  }
  </output>
  <reasoning>
    Base: (120/100) × 258 = 309.6 kcal. Cooking = kho (braising): +10% fat from oil, 
    +medium sugar adds ~3–4g carbs to MID. MID ≈ 318 kcal. LOW is lighter kho with 
    less sugar/oil (−15%). HIGH is richer kho with more caramelized sugar and oil (+20%).
    sugar_braised=medium → MID carbs include ~3g added sugar. oil_usage=normal → 
    standard fat adjustment, no additional widening.
  </reasoning>
</example>

${ingredientData}
${unmatchedSection}

<output_format>
  Return JSON matching the provided schema.
  Each object must include: ingredientName, mealItemName, low, mid, high.
  ingredientName must exactly match the name from the decomposition step.
  All numeric values rounded to 1 decimal place.
</output_format>`;
}
