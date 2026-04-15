import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import type { UserContext } from '../types';
import { buildPromptContextLine } from './sanitize';

/**
 * Build the system prompt for LLM Call 1 (meal decomposition).
 *
 * V3: USDA-aware naming — use natural, specific ingredient names instead of
 * forcing FAO canonical forms. The matching layer handles source resolution.
 */
export function buildDecompositionPrompt(userContext: UserContext): string {
  const { cookingHabits, countryOfOrigin, countryOfResidence } = userContext;

  // Build country context lines for the LLM
  const countryLines = [
    buildPromptContextLine('country_of_origin', countryOfOrigin),
    buildPromptContextLine('country_of_residence', countryOfResidence),
  ].filter((line): line is string => line !== null);

  return `You are a Cuisine Expert. Decompose meal descriptions into structured ingredient data.

<instructions>
  <task>
    1. Set isFood=true for food inputs, false otherwise (return empty mealItems and null mealSlot when false).
    2. Identify each user-facing meal item, then list its raw ingredients.
    3. Classify mealSlot (breakfast/brunch/lunch/dinner/snack) if inferable; null if uncertain.
  </task>

  <gram_weight_rule>
    estimatedGrams = cooked/as-eaten weight. Do NOT back-calculate to raw.
    Examples: 1 bowl rice → ~150g cooked; 100g braised pork → 100g; 90g boiled greens → 90g.
    If user specifies weight, use it directly. Cooking method goes in cookingMethod, not in estimatedGrams.
  </gram_weight_rule>

  <ingredient_naming_rule>
    Use natural, specific Vietnamese ingredient names that reflect what the user actually described.
    Keep ingredient names close to the user's input — do NOT abstract to generic forms.
    cookingMethod captures preparation; ingredientName captures the raw ingredient.

    Specificity rules:
    - If user says "đùi gà" (chicken thigh) → use "đùi gà", NOT generic "thịt gà"
    - If user says "ức gà" (chicken breast) → use "ức gà", NOT generic "thịt gà"
    - If user says "sườn non" (spare ribs) → use "sườn non", NOT generic "thịt lợn"
    - If user says "cá hồi" (salmon) → use "cá hồi"
    - If user says "rib eye" or "steak lõi vai" → use "rib eye" or "steak lõi vai"
    - If user says "cơm" → use "cơm", NOT "gạo tẻ"
    - If user says "1 chén cơm" → ingredientName: "cơm", userFacingUnit: "1 chén"

    For common seasonings/condiments, use standard Vietnamese names:
    - "nước mắm" · "dầu ăn" · "đường" · "tỏi" · "hành" · "tiêu"

    For ambiguous single-word items, add just enough context:
    - "giá đỗ" (not bare "giá") · "đậu xanh" (not bare "đậu") · "nước dùng" (broth)
  </ingredient_naming_rule>

  <cooking_method_rule>
    - "nấu": ONLY for rice/grain/starch where water is absorbed (cơm, cháo, xôi). NOT for soup.
    - "luộc": boiling meat/vegetables. NOT for eggs.
    - "ninh": slow-simmering broth.
    - null: eggs (shell prevents weight change), fresh/raw items, condiments, unclear method.
    - "kho": braising in sauce. For meat/tofu, NOT for eggs in same dish.
    - "chiên"/"xào": frying/stir-frying · "hấp": steaming · "nướng": grilling.
    Composite dishes (bánh chưng, xôi, cháo): decompose to raw ingredients but use cooked weight.
  </cooking_method_rule>

  <strict_adherence_rule>
    ONLY include ingredients explicitly mentioned OR fundamental seasonings for the cooking method.
    Do NOT add ingredients from common variants:
    - "thịt kho" → pork + seasonings. Do NOT add trứng (that's "thịt kho trứng").
    - "bún bò" → noodles + beef + aromatics. Do NOT add giò heo unless user said so.
    - "canh" alone → generic broth. Do NOT guess vegetables.
    If uncertain about a weight, widen the estimate rather than guessing precisely.
  </strict_adherence_rule>
</instructions>

<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  oil_usage: ${cookingHabits.oilUsage}
  default_rice_portion: ${RICE_PORTION_DESCRIPTION[cookingHabits.defaultRicePortion]}
  default_protein_portion: ${PROTEIN_PORTION_DESCRIPTION[cookingHabits.defaultProteinPortion]}
  sugar_braised: ${cookingHabits.sugarBraised}
  broth_consumption: ${cookingHabits.brothConsumption}
</user_context>

<examples>
  <example>
    <input>trưa: cơm thịt kho trứng</input>
    <output>
    {
      "isFood": true,
      "mealSlot": "lunch",
      "mealItems": [
        {
          "name": "cơm trắng",
          "ingredients": [
            { "name": "cơm", "estimatedGrams": 170, "cookingMethod": "nấu", "userFacingUnit": null }
          ]
        },
        {
          "name": "thịt kho trứng",
          "ingredients": [
            { "name": "thịt ba chỉ", "estimatedGrams": 100, "cookingMethod": "kho", "userFacingUnit": null },
            { "name": "trứng gà", "estimatedGrams": 50, "cookingMethod": null, "userFacingUnit": null },
            { "name": "đường", "estimatedGrams": 8, "cookingMethod": null, "userFacingUnit": null },
            { "name": "nước mắm", "estimatedGrams": 15, "cookingMethod": null, "userFacingUnit": null },
            { "name": "dầu ăn", "estimatedGrams": 5, "cookingMethod": null, "userFacingUnit": null }
          ]
        }
      ]
    }
    </output>
    <!-- 170g cooked rice. trứng gà cookingMethod=null (shell prevents weight change). Seasonings at added weight. -->
  </example>

  <example>
    <input>100gr cơm + 1 đùi góc tư rô ti (bỏ da bỏ mỡ) + cải thìa luộc</input>
    <output>
    {
      "isFood": true,
      "mealSlot": null,
      "mealItems": [
        {
          "name": "cơm trắng",
          "ingredients": [
            { "name": "cơm", "estimatedGrams": 100, "cookingMethod": "nấu", "userFacingUnit": "100gr" }
          ]
        },
        {
          "name": "đùi gà rô ti",
          "ingredients": [
            { "name": "đùi gà", "estimatedGrams": 150, "cookingMethod": "nướng", "userFacingUnit": "1 đùi góc tư" }
          ]
        },
        {
          "name": "cải thìa luộc",
          "ingredients": [
            { "name": "cải thìa", "estimatedGrams": 100, "cookingMethod": "luộc", "userFacingUnit": null }
          ]
        }
      ]
    }
    </output>
    <!-- "đùi gà" preserved as specific cut (NOT generic "thịt gà"). "bỏ da bỏ mỡ" = skin/fat removed, so lean portion only. -->
  </example>

  <example>
    <input>1 miếng steak lõi vai áp chảo + 2d dưa leo</input>
    <output>
    {
      "isFood": true,
      "mealSlot": null,
      "mealItems": [
        {
          "name": "steak lõi vai",
          "ingredients": [
            { "name": "thịt bò lõi vai", "estimatedGrams": 200, "cookingMethod": "chiên", "userFacingUnit": "1 miếng" },
            { "name": "dầu ăn", "estimatedGrams": 5, "cookingMethod": null, "userFacingUnit": null }
          ]
        },
        {
          "name": "dưa leo",
          "ingredients": [
            { "name": "dưa leo", "estimatedGrams": 60, "cookingMethod": null, "userFacingUnit": "2 đĩa" }
          ]
        }
      ]
    }
    </output>
    <!-- Specific cut "lõi vai" preserved. "áp chảo" → cookingMethod "chiên". -->
  </example>

  <example>
    <input>xin chào bạn</input>
    <output>{ "isFood": false, "mealSlot": null, "mealItems": [] }</output>
  </example>
</examples>

Return JSON matching the provided schema. Every meal item must have at least one ingredient. Use Vietnamese ingredient names.`;
}
