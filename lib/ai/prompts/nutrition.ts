import {
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
 * Note: grams from Step 1 are as-eaten weights. db_state tells the LLM
 * whether the DB per-100g row is raw/cooked/unknown.
 */

/**
 * Collator for deterministic Vietnamese ingredient ordering.
 * Sorting matched ingredients before building the prompt XML stabilizes
 * Gemini's prompt cache prefix for repeated similar inputs.
 */
const viCollator = new Intl.Collator('vi', { sensitivity: 'base' });

type PromptIngredient = DecomposedMealItem['ingredients'][number];

const escapeXmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');

const ingredientDisplayName = (ing: PromptIngredient): string =>
  ing.rawName ?? ing.name ?? ing.canonicalName ?? '';

const ingredientCanonicalName = (ing: PromptIngredient): string =>
  ing.canonicalName ?? ing.rawName ?? ing.name ?? '';

const ingredientGrams = (ing: PromptIngredient): number =>
  ing.grams ?? ing.estimatedGrams ?? 0;

const ingredientCookingMethod = (
  item: DecomposedMealItem,
  ing: PromptIngredient
): string | null => item.cookingMethod ?? ing.cookingMethod ?? null;

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

  const matchedLookup = new Map(
    matched
      .filter((m) => m.ingredientId)
      .map((m) => [m.ingredientId as string, m])
  );
  const matchedByName = new Map(matched.map((m) => [m.ingredientName, m]));

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
        .map(ingredientDisplayName)
        .sort()
        .join('\0');
      const bKey = [...b.ingredients]
        .map(ingredientDisplayName)
        .sort()
        .join('\0');
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    })
    .map((item) => ({
      ...item,
      ingredients: [...item.ingredients].sort((a, b) =>
        viCollator.compare(ingredientDisplayName(a), ingredientDisplayName(b))
      ),
    }));

  let ingredientData = '<ingredient_data>\n';
  ingredientData +=
    '  <!-- as_eaten_grams is the user-facing portion. db_state tells you whether the per_100g values are raw or cooked. -->\n\n';

  for (const mealItem of sortedMealItems) {
    ingredientData += `  <meal_item name="${escapeXmlAttribute(mealItem.name)}">\n`;

    for (const ing of mealItem.ingredients) {
      const match = ing.ingredientId
        ? (matchedLookup.get(ing.ingredientId) ??
          matchedByName.get(ingredientDisplayName(ing)))
        : matchedByName.get(ingredientDisplayName(ing));
      if (match) {
        const dbState = match.dbState ?? 'unknown';
        const cookingMethod = ingredientCookingMethod(mealItem, ing);
        ingredientData += `    <ingredient name="${escapeXmlAttribute(ingredientDisplayName(ing))}" as_eaten_grams="${ingredientGrams(ing)}" id="${escapeXmlAttribute(ing.ingredientId ?? '')}" canonicalName="${escapeXmlAttribute(ingredientCanonicalName(ing))}" source="db_matched" db_name="${escapeXmlAttribute(match.matchedName)}" db_state="${escapeXmlAttribute(dbState)}"${cookingMethod ? ` cooking="${escapeXmlAttribute(cookingMethod)}"` : ''}${ing.expectedState ? ` expected_state="${escapeXmlAttribute(ing.expectedState)}"` : ''}>\n`;
        ingredientData += `      <per_100g caloriesKcal="${match.nutritionPer100g.caloriesKcal ?? '?'}" proteinG="${match.nutritionPer100g.proteinG ?? '?'}" carbohydrateG="${match.nutritionPer100g.carbohydrateG ?? '?'}" fatG="${match.nutritionPer100g.fatG ?? '?'}" />\n`;
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
      "  <!-- No DB match found. Use your culinary knowledge of the user's cuisine and FAO/USDA food composition data for estimates. -->\n";

    for (const mealItem of sortedMealItems) {
      const unmatchedIngs = mealItem.ingredients.filter((ing) =>
        unmatchedNames.has(ingredientDisplayName(ing))
      );
      if (unmatchedIngs.length > 0) {
        unmatchedSection += `  <meal_item name="${escapeXmlAttribute(mealItem.name)}">\n`;
        for (const ing of unmatchedIngs) {
          const cookingMethod = ingredientCookingMethod(mealItem, ing);
          unmatchedSection += `    <ingredient name="${escapeXmlAttribute(ingredientDisplayName(ing))}" as_eaten_grams="${ingredientGrams(ing)}" id="${escapeXmlAttribute(ing.ingredientId ?? '')}" canonicalName="${escapeXmlAttribute(ingredientCanonicalName(ing))}"${cookingMethod ? ` cooking="${escapeXmlAttribute(cookingMethod)}"` : ''}${ing.expectedState ? ` expected_state="${escapeXmlAttribute(ing.expectedState)}"` : ''} />\n`;
        }
        unmatchedSection += `  </meal_item>\n`;
      }
    }

    unmatchedSection += '</unmatched_ingredients>\n';
  }

  return `You are a nutrition expert. Produce cooking-adjusted, bounded nutrition estimates based on the user's cuisine and cooking context.

<instructions>
  <task>
    For each ingredient in each meal item, produce LOW/MID/HIGH for 4 macros: caloriesKcal, proteinG, carbohydrateG, fatG.
  </task>

  <calculation>
    Each ingredient has db_state: "raw" | "cooked" | "unknown".

    1. db_state="cooked": per_100g values are already cooked.
       Scale base = (as_eaten_grams / 100) × per_100g, then adjust as needed
       for the *user's actual cooking style* (e.g., extra oil from "nhiều dầu"
       cooking habit). No raw/cooked conversion needed — both sides are cooked.

    2. db_state="raw": per_100g values are raw, as_eaten_grams is cooked.
       adjust for cooking method using your knowledge:
         - frying (chiên/rán/xào) absorbs cooking oil → fat goes UP
         - boiling (luộc/nấu) drives moisture changes; rice absorbs water → mass UP
         - grilling (nướng) drives moisture out → density UP
       Produce final macros for the as-eaten portion.

    3. db_state="unknown": treat as "raw" but widen LOW/HIGH bounds — uncertainty
       is higher because the reference frame is ambiguous.

    For unmatched ingredients (no db row): use your culinary knowledge of the user's cuisine and region
    (informed by the user's origin and residence context in <user_context>, plus FAO/USDA food composition data)
    for typical macros at the as-eaten weight. Be wider on bounds.

    MID = your best estimate after cooking adjustment. LOW/HIGH bracket
    physical-world uncertainty (portion guess + cooking variance).
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
    For ingredients in <unmatched_ingredients>: use your culinary knowledge of the user's cuisine and region
    (informed by the user's origin and residence context in <user_context>, plus FAO/USDA food composition data) to estimate.
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
