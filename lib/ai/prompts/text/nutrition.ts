/**
 * Verbatim prompt text for LLM Call 2 (cooking-adjusted bounded nutrition).
 *
 * Data, not logic: these two functions are the prompt strings and nothing
 * else. Every runtime part they interpolate is computed by
 * `build/nutrition-xml.ts` and handed in. Changing a single character here
 * changes model output — treat edits as a prompt change, not a refactor.
 *
 * Principle A (spec §2): the strings read only the user's cooking identity.
 * Goal, aggression, and calorie targets never appear.
 * Spec: docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */
import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '@/lib/ai/prompts/text/portion-descriptions';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

/** Everything the two prompt strings interpolate. */
export interface NutritionPromptParts {
  cookingHabits: PromptPersonalizationContext['cookingHabits'];
  countryLines: string[];
  ingredientData: string;
  unmatchedSection: string;
}

/** V2 compressed prompt: no hardcoded %, the LLM decides the bounds. */
export function compressedNutritionPromptText(
  parts: NutritionPromptParts,
  outputLanguage: string
): string {
  const { cookingHabits, countryLines, ingredientData, unmatchedSection } =
    parts;

  return `You are a nutrition estimator. Return JSON only.

<contract>
  output_language: ${outputLanguage}
  Produce LOW/MID/HIGH for caloriesKcal, proteinG, carbohydrateG, fatG.
  Echo mealItemName and ingredientName exactly from the input facts.
  Keep output names in output_language unless exact echo fields are provided.
</contract>

<calculation_rules>
   For each MATCHED ingredient (those with a <base> element), the server uses base for protein, carb, and calories directly — it overrides your output for those three. You ONLY need to reason about fatG, UNLESS the ingredient has a prep_notes attribute (see prep_notes_rule below):
     - fatG.mid: adjust base.fatG for cooking method.
         · chiên/rán/xào (frying): absorbed oil raises fat by ~30–80% over base.
         · luộc/hấp (boiling/steaming) with no added oil: fat stays near base.
         · nướng (grilling) without basting/oil: fat near base; light moisture loss only.
         · kho (simmer with sugar/soy/oil): fat raised modestly by added oil.
     - fatG.low / fatG.high: portion + cooking uncertainty around your fatG.mid (typically ±15–25%).
     - Fat adjustments stay within ~0.5–2× of base.fatG. Going beyond that is treated as a hallucination and the server snaps fatG.mid back to base.fatG; do not try.
     - Cooking method does NOT physically change protein or carb per gram — the server discards your output for those macros. You may emit them (the schema requires it), but they will not be used. Spend your reasoning on fatG.
   db_state="cooked": base already reflects cooked food.
   db_state="raw": base.fatG reflects raw mass; apply cooking adjustment when oil is added.
   db_state="unknown": widen fatG.low / fatG.high but keep fatG.mid near base.fatG.
   weight_basis="raw" (when present): the server already used the user's raw weight to scale base 1:1 against a raw DB row. Do NOT add a second cooking-yield adjustment on top — base is correct as given. Apply oil/fat adjustments only if cooking adds oil.
   For UNMATCHED ingredients (no DB row, no <base>): estimate ABSOLUTE LOW/MID/HIGH for all four macros for the as-eaten portion from cuisine knowledge. The meal item name is your primary context.
   Bounds express physical uncertainty (portion guess + cooking variance), never user goals or preferences.
   Keep every triple ordered low <= mid <= high and non-negative.
   Macro identity holds for unmatched: kcal ~= 4*protein + 4*carbs + 9*fat. The server derives kcal from this identity for matched ingredients.
   Physical density ceiling: high kcal <= 900/100g; high protein/carbs/fat <= 100g/100g.
</calculation_rules>

<prep_notes_rule>
   When an ingredient has a prep_notes attribute (e.g. prep_notes="bỏ da | bỏ mỡ", prep_notes="extra oil", prep_notes="nước trong"), the user typed a verbatim preparation modifier that should MOVE the macros for that ingredient on top of normal cooking adjustment.
   - For MATCHED ingredients with prep_notes, the server unlocks protein and carb (in addition to fat) so you can reflect the modifier. Move only what the note physically implies; calories are still derived from 4P + 4C + 9F.
   - Bounded swings — the server enforces these caps and will snap back to base if you exceed them:
       · proteinG, carbohydrateG: stay within 0.71× to 1.4× of base.
       · fatG: stay within 0.5× to 2× of base.
   - Typical patterns (use cuisine knowledge to interpret others):
       · "bỏ da", "bỏ mỡ", "skinless", "lean only", "trimmed": fat down ~30–50% of base, protein up ~10–20% per gram of remaining tissue.
       · "extra oil", "thêm dầu", "with butter", "phết bơ": fat up ~50–100% of base.
       · "không dầu", "no oil", "dry-fried", "air-fried": fat near base or slightly below (no added oil absorption).
       · "nước trong" (clear broth), "low-fat", "ít béo": fat/calories down modestly.
       · "extra sauce", "sốt đậm", "thêm đường": carb up modestly if sweet.
       · Flavor / sodium / spice only ("ít muối", "no MSG", "extra spicy", "cay nhiều"): keep all macros at base — no adjustment.
   - If a prep_notes value would imply a swing larger than the band allows, you are probably misreading it as a prep modifier — it likely belongs in a different field; emit values at the boundary of the band rather than further.
</prep_notes_rule>

<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  oil_usage: ${cookingHabits.oilUsage}
  sugar_braised: ${cookingHabits.sugarBraised}
  default_rice_portion: ${RICE_PORTION_DESCRIPTION[cookingHabits.defaultRicePortion]}
  default_protein_portion: ${PROTEIN_PORTION_DESCRIPTION[cookingHabits.defaultProteinPortion]}
  broth_consumption: ${cookingHabits.brothConsumption}
</user_context>

${ingredientData}
${unmatchedSection}

<output_format>
  Return top-level mealItems[].
  Each meal item: mealItemName + ingredients[].
  Each ingredient: ingredientName + 4 macro triples {low, mid, high}.
  Round to 1 decimal place.
</output_format>`;
}

/** V1 verbose prompt, kept for debugging via PIPELINE_NUTRITION_PROMPT_LABEL. */
export function nutritionPromptText(parts: NutritionPromptParts): string {
  const { cookingHabits, countryLines, ingredientData, unmatchedSection } =
    parts;

  return `You are a nutrition expert. Produce cooking-adjusted, bounded nutrition estimates based on the user's cuisine and cooking context.

<instructions>
  <task>
    For each ingredient in each meal item, produce LOW/MID/HIGH for 4 macros: caloriesKcal, proteinG, carbohydrateG, fatG.
  </task>

  <base_reference>
    For each MATCHED ingredient, the server has precomputed and shown you a <base> element with base.caloriesKcal / proteinG / carbohydrateG / fatG. base = (per_100g × as_eaten_grams) / 100, using raw-or-cooked grams depending on db_state.
    The server uses base directly for protein, carb, and calories — it OVERRIDES your output for those three macros. You only need to reason about fatG for matched ingredients. The schema requires you to emit all four macros (so emit any reasonable value for the others), but only fatG affects downstream nutrition.
    Do NOT echo per_100g as MID; do NOT multiply per_100g by 100; the server has already done the multiplication for you.
  </base_reference>

  <calculation>
    For MATCHED ingredients (those with a <base> element), focus on fatG only — UNLESS the ingredient has a prep_notes attribute (see <prep_notes_rule> below):

    1. fatG.mid: adjust base.fatG using cooking knowledge.
         - chiên/rán/xào (frying with oil) absorbs cooking oil → fat raised by ~30–80% over base.
         - luộc/hấp (boiling/steaming) without added oil → fat near base.
         - nướng (grilling) without basting/oil → fat near base; light moisture loss only.
         - kho (simmer with sugar/soy/oil) → fat raised modestly by added oil.

    2. fatG.low / fatG.high: portion + cooking uncertainty around your fatG.mid (typically ±15–25%).

    3. db_state="cooked": base.fatG already reflects cooked food.
       db_state="raw": base.fatG reflects raw mass; apply the cooking-method adjustment.
       db_state="unknown": widen fatG.low / fatG.high but keep fatG.mid near base.fatG.

    4. weight_basis="raw" (when present): the server already used the user's raw weight to scale base 1:1 against a raw DB row. Do NOT add a second cooking-yield adjustment on top — base is correct as given. Apply oil/fat adjustments only if cooking adds oil.

    5. proteinG, carbohydrateG, caloriesKcal for matched ingredients (no prep_notes): emit any reasonable value (the schema requires it). The server discards these and recomputes from base + your fatG via the macro identity 4P + 4C + 9F. Do not spend reasoning budget on them.

    For UNMATCHED ingredients (no <base> shown): estimate absolute LOW/MID/HIGH for all four macros for the as-eaten portion from cuisine knowledge. The meal item name is the primary context.

    Realistic fat adjustments stay within ~0.5–2× of base.fatG. Numbers beyond that are treated as hallucinations and the server snaps fatG.mid back to base.fatG — do not try.

    Macro identity (for unmatched): kcal ~= 4*protein + 4*carbs + 9*fat.
    Physical density ceiling: high kcal <= 900/100g; high protein/carbs/fat <= 100g/100g.
  </calculation>

  <prep_notes_rule>
    When an ingredient has a prep_notes attribute (e.g. prep_notes="bỏ da | bỏ mỡ", prep_notes="extra oil", prep_notes="nước trong"), the user typed a verbatim preparation modifier that should MOVE the macros for that ingredient on top of normal cooking adjustment.

    For MATCHED ingredients with prep_notes, the server unlocks protein and carb (in addition to fat) so you can reflect the modifier. Move only what the note physically implies; calories are still derived from 4P + 4C + 9F.

    Bounded swings — the server enforces these caps and will snap back to base if you exceed them:
      - proteinG, carbohydrateG: stay within 0.71× to 1.4× of base.
      - fatG: stay within 0.5× to 2× of base.

    Typical patterns (use cuisine knowledge to interpret others):
      - "bỏ da", "bỏ mỡ", "skinless", "lean only", "trimmed": fat down ~30–50% of base; protein up ~10–20% per gram of remaining tissue.
      - "extra oil", "thêm dầu", "with butter", "phết bơ": fat up ~50–100% of base.
      - "không dầu", "no oil", "dry-fried", "air-fried": fat near base or slightly below (no added oil absorption).
      - "nước trong" (clear broth), "low-fat", "ít béo": fat / kcal down modestly.
      - "extra sauce", "sốt đậm", "thêm đường": carb up modestly if sweet.
      - Flavor / sodium / spice only ("ít muối", "no MSG", "extra spicy", "cay nhiều"): keep all macros at base — no adjustment.

    If a prep_notes value would imply a swing larger than the band allows, you are probably misreading it as a prep modifier — emit values at the boundary of the band rather than further.
  </prep_notes_rule>

  <why_three_values>
    For matched ingredients, only fatG's triple matters — protein/carb/kcal are server-anchored.
    For unmatched, each macro is a triple LOW/MID/HIGH expressing genuine uncertainty about
    the user's actual portion and cooking behavior — not a preference signal.
    - MID: your best point estimate after cooking adjustment.
    - LOW: conservative lower bound. Tighten for DB-matched + standard portion; widen for fried-in-oil or ambiguous portion.
    - HIGH: conservative upper bound. Same widening rules.
  </why_three_values>

  <unmatched_rule>
    Each unmatched ingredient is nested under its parent <meal_item>. Use the meal item name as primary context — same ingredient differs by dish:
    - "nước dùng" in "canh rau lang tôm" → light broth ~5–8 kcal/100g
    - "nước dùng" in "bún bò Huế" → rich bone broth ~30–50 kcal/100g
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
  Matched: gạo tẻ, 65g raw, nấu, DB: 352 kcal/100g raw. Server shows base.fatG=0.3.
  Cooking is "nấu" (boiling) with no added oil → fat stays near base.
  → fatG {low: 0.2, mid: 0.3, high: 0.5}. Other macros: emit any reasonable value (e.g., copy base) — server overrides.

  Matched, frying: chả giò tôm, 150g chiên, DB cooked: 180 kcal/100g, fatG/100g=6.5. Server shows base.fatG=9.75.
  Frying adds absorbed oil — raise fatG.mid ~30–60% over base.
  → fatG {low: 11, mid: 14, high: 18}. Server derives kcal from 4P + 4C + 9F using DB-anchored P/C and your fat.

  Unmatched: nem lụi, 80g grilled. No DB row, no <base>.
  → all four macros from cuisine knowledge: caloriesKcal {low: 170, mid: 200, high: 240}, proteinG {low: 13, mid: 14, high: 16}, carbohydrateG {low: 2, mid: 2.5, high: 3}, fatG {low: 12, mid: 14, high: 17}.
</example>

${ingredientData}
${unmatchedSection}

<output_format>
  Return JSON: top-level "mealItems" array. Each has "mealItemName" + "ingredients" array.
  Each ingredient: "ingredientName" + 4 nutrients {low, mid, high}. Match names from decomposition exactly.
  Round to 1 decimal place.
</output_format>`;
}
