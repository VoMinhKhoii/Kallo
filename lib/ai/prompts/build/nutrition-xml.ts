/**
 * Render the runtime parts of the Call-2 nutrition prompt: the deterministic
 * `<ingredient_data>` / `<unmatched_ingredients>` XML plus the sanitized
 * country lines. The prompt text itself lives in `text/nutrition.ts`.
 */
import {
  ingredientCanonicalName,
  ingredientDisplayName,
  ingredientGrams,
} from '@/lib/ai/pipeline/contracts/ingredient-accessors';
import { buildPromptContextLine } from '@/lib/ai/prompts/sanitize';
import type { NutritionPromptParts } from '@/lib/ai/prompts/text/nutrition';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { DecomposedMealItem } from '@/lib/ai/types/decomposition';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { MacroBase } from '@/lib/ai/types/nutrition-adjustment';

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

// Ingredient first, dish second — matching `bounded-macros`, `validation` and
// `assembly`. An ingredient's own method is the more specific signal; the dish
// method is the fallback for ingredients Call 1 left unlabelled.
const ingredientCookingMethod = (
  item: DecomposedMealItem,
  ing: PromptIngredient
): string | null => ing.cookingMethod ?? item.cookingMethod ?? null;

/**
 * Render prep notes as a `prep_notes` XML attribute fragment when the
 * ingredient carries at least one non-empty entry, otherwise emit nothing.
 * Multiple notes are joined with " | " to keep the attribute single-line
 * and trivially LLM-parseable. Empty / absent ⇒ no attribute ⇒ identical
 * XML to the pre-feature baseline (preserves Gemini prompt-cache prefix).
 */
const prepNotesAttr = (ing: PromptIngredient): string => {
  const notes = ing.prepNotes;
  if (!notes || notes.length === 0) return '';
  const cleaned = notes
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0);
  if (cleaned.length === 0) return '';
  return ` prep_notes="${escapeXmlAttribute(cleaned.join(' | '))}"`;
};

/**
 * Render the weight_basis attribute when the user explicitly weighed raw.
 * Default (as_eaten) emits nothing so XML matches the pre-feature baseline.
 */
const weightBasisAttr = (ing: PromptIngredient): string =>
  ing.weightBasis === 'raw' ? ` weight_basis="raw"` : '';

function fmtBase(value: number): string {
  // 1 decimal place is enough for the prompt; avoid trailing zeros.
  return (Math.round(value * 10) / 10).toString();
}

export function buildNutritionPromptParts(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  baseMap: Map<string, MacroBase> = new Map()
): NutritionPromptParts {
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
    '  <!-- The server has already computed base = per_100g × as_eaten_grams / 100 for each macro. For matched ingredients, the server uses base directly for protein, carb, and calories — you only need to reason about fatG (cooking-method adjustment). Your other macros are logged for QA but discarded. For unmatched ingredients (no <base> element), provide LOW/MID/HIGH for all four macros. -->\n\n';

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
        const base = ing.ingredientId
          ? baseMap.get(ing.ingredientId)
          : undefined;
        ingredientData += `    <ingredient name="${escapeXmlAttribute(ingredientDisplayName(ing))}" as_eaten_grams="${ingredientGrams(ing)}" canonicalName="${escapeXmlAttribute(ingredientCanonicalName(ing))}" source="db_matched" db_name="${escapeXmlAttribute(match.matchedName)}" db_state="${escapeXmlAttribute(dbState)}"${cookingMethod ? ` cooking="${escapeXmlAttribute(cookingMethod)}"` : ''}${ing.expectedState ? ` expected_state="${escapeXmlAttribute(ing.expectedState)}"` : ''}${weightBasisAttr(ing)}${prepNotesAttr(ing)}>\n`;
        ingredientData += `      <per_100g caloriesKcal="${match.nutritionPer100g.caloriesKcal ?? '?'}" proteinG="${match.nutritionPer100g.proteinG ?? '?'}" carbohydrateG="${match.nutritionPer100g.carbohydrateG ?? '?'}" fatG="${match.nutritionPer100g.fatG ?? '?'}" />\n`;
        if (base) {
          ingredientData += `      <base caloriesKcal="${fmtBase(base.caloriesKcal)}" proteinG="${fmtBase(base.proteinG)}" carbohydrateG="${fmtBase(base.carbohydrateG)}" fatG="${fmtBase(base.fatG)}" />\n`;
        }
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
      '  <!-- No DB match found. For each ingredient below, emit ABSOLUTE LOW/MID/HIGH triples (NOT per-100g) for caloriesKcal, proteinG, carbohydrateG, fatG, scaled to the listed as_eaten_grams. Internally: think in per-100g density (using your culinary knowledge + FAO/USDA priors), then multiply by as_eaten_grams/100. Real-world per-100g density anchors for common Vietnamese street foods: nem lụi (grilled pork) ~250–290 kcal/100g; chả giò (fried spring roll) ~250–320 kcal/100g; bún tươi (cooked rice vermicelli) ~100–130 kcal/100g; nước dùng (broth) ~5–50 kcal/100g depending on the dish; sốt đậu phộng (peanut sauce) ~250–350 kcal/100g; sốt tương đậu (fermented soybean sauce) ~120–180 kcal/100g. Stay within the physical-density ceilings below — if your kcal.mid/100g > 900, you are hallucinating; recompute. -->\n';

    for (const mealItem of sortedMealItems) {
      const unmatchedIngs = mealItem.ingredients.filter((ing) =>
        unmatchedNames.has(ingredientDisplayName(ing))
      );
      if (unmatchedIngs.length > 0) {
        unmatchedSection += `  <meal_item name="${escapeXmlAttribute(mealItem.name)}">\n`;
        for (const ing of unmatchedIngs) {
          const cookingMethod = ingredientCookingMethod(mealItem, ing);
          unmatchedSection += `    <ingredient name="${escapeXmlAttribute(ingredientDisplayName(ing))}" as_eaten_grams="${ingredientGrams(ing)}" canonicalName="${escapeXmlAttribute(ingredientCanonicalName(ing))}"${cookingMethod ? ` cooking="${escapeXmlAttribute(cookingMethod)}"` : ''}${ing.expectedState ? ` expected_state="${escapeXmlAttribute(ing.expectedState)}"` : ''}${weightBasisAttr(ing)}${prepNotesAttr(ing)} />\n`;
        }
        unmatchedSection += `  </meal_item>\n`;
      }
    }

    unmatchedSection += '</unmatched_ingredients>\n';
  }

  return { cookingHabits, countryLines, ingredientData, unmatchedSection };
}
