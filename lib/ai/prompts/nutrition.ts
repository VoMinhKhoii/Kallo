import {
  ingredientCanonicalName,
  ingredientDisplayName,
  ingredientGrams,
} from '@/lib/ai/pipeline/contracts/ingredient-accessors';
import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import type {
  DecomposedMealItem,
  MacroBase,
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

export const NUTRITION_PROMPT_LABEL_ENV = 'PIPELINE_NUTRITION_PROMPT_LABEL';

export type NutritionPromptLabel = 'production' | 'compressed';
export type NutritionPromptBuilder = (
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  // Optional in the type so test/fixture callers without DB context can still
  // render the prompt; the orchestrator always supplies a populated map.
  baseMap?: Map<string, MacroBase>
) => string;

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

interface NutritionPromptParts {
  cookingHabits: PromptPersonalizationContext['cookingHabits'];
  countryLines: string[];
  ingredientData: string;
  unmatchedSection: string;
}

export function getNutritionPromptLabel(
  env: Record<string, string | undefined> = process.env
): NutritionPromptLabel {
  // Default 'compressed' (set 2026-05-09). The 2026-05-12 macro-anchor fix
  // and the 2026-05-13 fat-only contract together make this safe under any
  // STABLE_PROFILE model: the server does all P/C/kcal math for matched
  // ingredients and only the fat triple actually flows downstream. Set
  // `PIPELINE_NUTRITION_PROMPT_LABEL=production` to render the verbose prompt
  // for debugging.
  return env[NUTRITION_PROMPT_LABEL_ENV] === 'production'
    ? 'production'
    : 'compressed';
}

export function getNutritionPromptBuilder(
  label: NutritionPromptLabel = getNutritionPromptLabel()
): NutritionPromptBuilder {
  return label === 'compressed'
    ? buildCompressedNutritionPrompt
    : buildNutritionPrompt;
}

function fmtBase(value: number): string {
  // 1 decimal place is enough for the prompt; avoid trailing zeros.
  return (Math.round(value * 10) / 10).toString();
}

function buildNutritionPromptParts(
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

export function buildCompressedNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  baseMap: Map<string, MacroBase> = new Map()
): string {
  const { cookingHabits, countryLines, ingredientData, unmatchedSection } =
    buildNutritionPromptParts(
      mealItems,
      matched,
      unmatched,
      userContext,
      baseMap
    );
  const outputLanguage = userContext.outputLanguage ?? 'match_user_input';

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

export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  baseMap: Map<string, MacroBase> = new Map()
): string {
  const { cookingHabits, countryLines, ingredientData, unmatchedSection } =
    buildNutritionPromptParts(
      mealItems,
      matched,
      unmatched,
      userContext,
      baseMap
    );

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
