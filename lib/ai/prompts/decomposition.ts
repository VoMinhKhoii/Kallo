import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import type { UserContext } from '../types';

/**
 * Build the system prompt for LLM Call 1 (meal decomposition).
 *
 * V2: Compressed from ~7.5K to ~3.5K tokens.
 * - 4 examples → 2 diverse + 1 minimal non-food
 * - Merged overlapping rules into terse instruction blocks
 * - Preserved all critical rules: gram_weight, ingredient_naming, cooking_method, strict_adherence
 */
export function buildDecompositionPrompt(userContext: UserContext): string {
  const { regionalProfile, cookingHabits } = userContext;

  return `You are a Vietnamese cuisine expert. Decompose meal descriptions into structured ingredient data.

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
    Use raw, uncooked Vietnamese ingredient names as they appear in a food composition database.
    cookingMethod captures preparation; ingredientName captures the raw ingredient.

    Key canonical names:
    - "gạo tẻ" (not cơm/cơm trắng) · "thịt lợn ba chỉ" (not thịt heo kho/ba chỉ heo)
    - "trứng gà" (chicken egg) · "đậu phụ" (not đậu phụ chiên)
    - "bún tươi" (fresh vermicelli) · "hạt tiêu đen" (not bare tiêu)
    - "đường trắng" (not bare đường) · "hành tím" (shallots)
    - "dầu ăn" (cooking oil) · "nước mắm" · "tỏi" · "rau muống"
    - "giá đỗ" (not bare giá) · "đậu xanh" (not bare đậu) · "nước dùng" (broth)
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

  <regional_priors>
    mien_bac: lighter seasoning, minimal sugar | mien_trung: spicy, fermented, moderate
    mien_nam: sweeter, coconut milk, generous | mien_tay: heavy oil, sweet, large, river fish
  </regional_priors>
</instructions>

<user_context>
  regional_profile: ${regionalProfile}
  oil_usage: ${cookingHabits.oilUsage}
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
            { "name": "gạo tẻ", "estimatedGrams": 170, "cookingMethod": "nấu", "userFacingUnit": null }
          ]
        },
        {
          "name": "thịt kho trứng",
          "ingredients": [
            { "name": "thịt lợn ba chỉ", "estimatedGrams": 100, "cookingMethod": "kho", "userFacingUnit": null },
            { "name": "trứng gà", "estimatedGrams": 50, "cookingMethod": null, "userFacingUnit": null },
            { "name": "đường trắng", "estimatedGrams": 8, "cookingMethod": null, "userFacingUnit": null },
            { "name": "nước mắm", "estimatedGrams": 15, "cookingMethod": null, "userFacingUnit": null },
            { "name": "dầu ăn", "estimatedGrams": 5, "cookingMethod": null, "userFacingUnit": null }
          ]
        }
      ]
    }
    </output>
    <!-- 170g cooked rice on plate. trứng gà cookingMethod=null (egg shell prevents weight change). Seasonings at added weight. -->
  </example>

  <example>
    <input>bún bò Huế 1 tô lớn</input>
    <output>
    {
      "isFood": true,
      "mealSlot": null,
      "mealItems": [
        {
          "name": "bún bò Huế",
          "ingredients": [
            { "name": "bún tươi", "estimatedGrams": 200, "cookingMethod": null, "userFacingUnit": "1 tô lớn" },
            { "name": "thịt bò", "estimatedGrams": 80, "cookingMethod": "ninh", "userFacingUnit": null },
            { "name": "sả", "estimatedGrams": 15, "cookingMethod": null, "userFacingUnit": null },
            { "name": "mắm ruốc", "estimatedGrams": 10, "cookingMethod": null, "userFacingUnit": null },
            { "name": "hành tím", "estimatedGrams": 20, "cookingMethod": null, "userFacingUnit": null },
            { "name": "ớt tươi", "estimatedGrams": 5, "cookingMethod": null, "userFacingUnit": null }
          ]
        }
      ]
    }
    </output>
    <!-- "ninh" for slow-simmered broth (NOT "nấu"). bún tươi served fresh (no cooking change). All weights are cooked/as-eaten. -->
  </example>

  <example>
    <input>xin chào bạn</input>
    <output>{ "isFood": false, "mealSlot": null, "mealItems": [] }</output>
  </example>
</examples>

Return JSON matching the provided schema. Every meal item must have at least one ingredient. Use Vietnamese ingredient names.`;
}
