import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import {
  ingredientCanonicalName,
  ingredientDisplayName,
  ingredientGrams,
} from '../pipeline/ingredient-accessors';
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

const ingredientCookingMethod = (
  item: DecomposedMealItem,
  ing: PromptIngredient
): string | null => item.cookingMethod ?? ing.cookingMethod ?? null;

interface NutritionPromptParts {
  cookingHabits: PromptPersonalizationContext['cookingHabits'];
  countryLines: string[];
  ingredientData: string;
  unmatchedSection: string;
}

export function getNutritionPromptLabel(
  env: Record<string, string | undefined> = process.env
): NutritionPromptLabel {
  // Default 'compressed' (set 2026-05-09). The original Phase B harness on
  // gemini-3.1-flash-lite showed 64–72 % warm-path latency reduction with no
  // quality regression — but the harness only validated against 3.1. When
  // STABLE_PROFILE falls back to gemini-2.5-flash-lite (today's prod default
  // when PIPELINE_MODEL_PROFILE is unset), 2.5 cannot reproduce the original
  // prompt's "scale per_100g by as_eaten_grams" arithmetic reliably and
  // returns physically impossible macros. The 2026-05-12 factors-only
  // refactor removes this dependency entirely: server multiplies, LLM only
  // bounds. Set `PIPELINE_NUTRITION_PROMPT_LABEL=production` to revert to
  // the verbose pre-factor prompt for debugging.
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
    '  <!-- The server has already computed base = per_100g × as_eaten_grams / 100 for each macro. You return ONLY {lowFactor, highFactor} per macro; the server multiplies base × factor to get final low/high. mid = base, always. -->\n\n';

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
        const base = ing.ingredientId ? baseMap.get(ing.ingredientId) : undefined;
        ingredientData += `    <ingredient name="${escapeXmlAttribute(ingredientDisplayName(ing))}" as_eaten_grams="${ingredientGrams(ing)}" canonicalName="${escapeXmlAttribute(ingredientCanonicalName(ing))}" source="db_matched" db_name="${escapeXmlAttribute(match.matchedName)}" db_state="${escapeXmlAttribute(dbState)}"${cookingMethod ? ` cooking="${escapeXmlAttribute(cookingMethod)}"` : ''}${ing.expectedState ? ` expected_state="${escapeXmlAttribute(ing.expectedState)}"` : ''}>\n`;
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
      "  <!-- No DB match found. For these ingredients ONLY, provide a per100gEstimate {caloriesKcal, proteinG, carbohydrateG, fatG} using your culinary knowledge of the user's cuisine and FAO/USDA food composition data. The server multiplies by as_eaten_grams to derive base, then applies your factor bounds. Do NOT multiply by grams yourself. -->\n";

    for (const mealItem of sortedMealItems) {
      const unmatchedIngs = mealItem.ingredients.filter((ing) =>
        unmatchedNames.has(ingredientDisplayName(ing))
      );
      if (unmatchedIngs.length > 0) {
        unmatchedSection += `  <meal_item name="${escapeXmlAttribute(mealItem.name)}">\n`;
        for (const ing of unmatchedIngs) {
          const cookingMethod = ingredientCookingMethod(mealItem, ing);
          unmatchedSection += `    <ingredient name="${escapeXmlAttribute(ingredientDisplayName(ing))}" as_eaten_grams="${ingredientGrams(ing)}" canonicalName="${escapeXmlAttribute(ingredientCanonicalName(ing))}"${cookingMethod ? ` cooking="${escapeXmlAttribute(cookingMethod)}"` : ''}${ing.expectedState ? ` expected_state="${escapeXmlAttribute(ing.expectedState)}"` : ''} />\n`;
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
   For each matched ingredient, the server has precomputed and SHOWN you base = per_100g × as_eaten_grams / 100 under <base>. Treat base as your starting anchor for MID, NOT your output verbatim. Then adjust MID upward or downward using your cooking knowledge:
     - chiên/rán/xào (frying): absorbed oil raises fat (and kcal) by 20–80%.
     - luộc rice (boiling): rice mass roughly triples from water absorption; per the parent meal item context, the as_eaten_grams may already reflect cooked rice.
     - nướng (grilling): moisture loss raises kcal density by 10–30%.
     - kho (simmer with sugar/soy): added sugar/oil raises kcal modestly.
   Realistic cooking adjustments stay within ~0.5–2× of base. Going beyond that is treated as a hallucination and the server snaps MID back to base; do not try.
   db_state="cooked": base already reflects cooked food; small adjustments only.
   db_state="raw": base reflects raw mass; apply cooking adjustment as above.
   db_state="unknown": widen LOW/HIGH but keep MID near base.
   For unmatched ingredients (no DB row, no <base>): estimate ABSOLUTE LOW/MID/HIGH for the as-eaten portion from cuisine knowledge. The meal item name is your primary context.
   Bounds express physical uncertainty (portion guess + cooking variance), never user goals or preferences.
   Keep every triple ordered low <= mid <= high and non-negative.
   Macro identity should hold: kcal ~= 4*protein + 4*carbs + 9*fat.
   Physical density ceiling: high kcal <= 900/100g; high protein/carbs/fat <= 100g/100g.
</calculation_rules>

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
    Use base as your anchor for MID. Then adjust MID using cooking knowledge (e.g., +25–40% for chiên/rán with oil; +0–10% for nướng moisture loss; +0% for db_state="cooked"). Then set LOW and HIGH around the adjusted MID to reflect physical uncertainty.
    Do NOT echo per_100g as MID; do NOT multiply per_100g by 100; the server has already done the multiplication for you.
  </base_reference>

  <calculation>
    Each ingredient has db_state: "raw" | "cooked" | "unknown".

    1. db_state="cooked": <base> already reflects cooked food. MID ≈ base unless the user's cooking style adds extra oil/sugar.

    2. db_state="raw": <base> reflects raw mass × per_100g. Adjust MID for cooking method using your knowledge:
         - frying (chiên/rán/xào) absorbs cooking oil → fat goes UP, kcal goes UP.
         - boiling (luộc/nấu) drives moisture changes; rice absorbs water.
         - grilling (nướng) drives moisture out → density UP.

    3. db_state="unknown": treat like "raw" but widen LOW/HIGH bounds.

    For UNMATCHED ingredients (no <base> shown): estimate absolute LOW/MID/HIGH for the as-eaten portion from cuisine knowledge. The meal item name is the primary context.

    Realistic cooking adjustments stay within ~0.5–2× of base. Numbers beyond that are treated as hallucinations and the server snaps MID back to base — do not try.

    Macro identity: kcal ~= 4*protein + 4*carbs + 9*fat.
    Physical density ceiling: high kcal <= 900/100g; high protein/carbs/fat <= 100g/100g.
  </calculation>

  <why_three_values>
    Each macro is a triple LOW/MID/HIGH expressing genuine uncertainty about
    the user's actual portion and cooking behavior — not a preference signal.
    - MID: your best point estimate after cooking adjustment (start from base, adjust).
    - LOW:  conservative lower bound. Tighten for DB-matched + standard portion; widen for fried-in-oil or ambiguous portion.
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
  Matched: gạo tẻ, 65g raw, nấu, DB: 352 kcal/100g.
  Server has computed and shown you base.caloriesKcal=229.
  Cooking is "nấu" — no macro change from cooked DB row.
  → {"ingredientName":"gạo tẻ","caloriesKcal":{"low":210,"mid":229,"high":250},...}

  Matched, frying: chả giò tôm, 150g chiên, DB cooked: 180 kcal/100g.
  Server has computed base.caloriesKcal=270.
  Frying adds oil — adjust MID upward, say +20–30%.
  → caloriesKcal {low: 280, mid: 330, high: 400}.

  Unmatched: nem lụi, 80g grilled. No DB row.
  → {"ingredientName":"nem lụi","caloriesKcal":{"low":170,"mid":200,"high":240},...}
</example>

${ingredientData}
${unmatchedSection}

<output_format>
  Return JSON: top-level "mealItems" array. Each has "mealItemName" + "ingredients" array.
  Each ingredient: "ingredientName" + 4 nutrients {low, mid, high}. Match names from decomposition exactly.
  Round to 1 decimal place.
</output_format>`;
}
