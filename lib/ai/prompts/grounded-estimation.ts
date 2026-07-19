import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '../constants';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '../pipeline/schemas-v2';
import { buildPromptContextLine } from './sanitize';
import type { PromptPersonalizationContext } from './types';

/**
 * V2 Call 2 — grounded estimation.
 *
 * What it does:
 *   1. CRAG verdict — for each ingredient with candidate matches, pick the
 *      correct one or reject all ("none" → unmatched path).
 *   2. Grams — emit as-eaten or pre-cooking mass in grams, scoped to the
 *      selected candidate's state. The server scales 1:1 with no
 *      convertCookedToRaw fudge.
 *   3. Macros — bounded triples, server-anchored for matched-without-prep-notes,
 *      LLM-driven within tight bands when prep_notes is non-empty.
 *
 * Prompt layout:
 *   STATIC PREFIX (universal rules — same bytes across all users / requests)
 *       ↓
 *   PER-USER BLOCK (<user_context> — same bytes within a user's session)
 *       ↓
 *   DYNAMIC SUFFIX (<original_prompt> + <ingredient_data> with candidates —
 *                   request-specific)
 *
 * Note: the original intent of this layout was to clear Vertex's implicit
 * context-cache threshold (≥2,048 tokens for Gemini 2.5; ≥4,096 for 3+).
 * Measured prefix today: ~1,341 tokens (compressed) / ~1,915 tokens
 * (production), both below the 2.5 floor. Implicit caching may not fire
 * unless padded; treat the layout as "ready to benefit when prefix grows"
 * rather than "actively cached".
 *
 * Output schema: groundedEstimationSchema in `pipeline/schemas.ts`.
 */

const escapeXmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');

const viCollator = new Intl.Collator('vi', { sensitivity: 'base' });

export interface MatchCandidate {
  /** Stable "c1", "c2", … id assigned by the orchestrator within one ingredient. */
  id: string;
  similarity: number;
  dbName: string;
  dbState: 'raw' | 'cooked' | 'unknown';
  source: 'fao' | 'usda';
  per100gKcal: number | null;
  per100gProteinG: number | null;
  per100gCarbohydrateG: number | null;
  per100gFatG: number | null;
  /** Inedible portion percentage (bones / skin / shell). Helps the LLM spot
   *  whole-bird vs specific-cut mismatches. */
  inediblePct: number | null;
}

export interface IngredientWithCandidates {
  ingredient: DecomposedIngredientV2;
  /** Candidates already sorted by similarity desc. May be empty (unmatched). */
  candidates: MatchCandidate[];
  /**
   * Server-resolved portion ANCHOR (Phase 3). When the portion resolver
   * grounded grams via the fallback ladder (explicit mass / packaged serving /
   * a concept-scoped prior), the mid grams is passed here so Call 2 does NOT
   * freely re-estimate the weight — it anchors to this number and only does
   * macro / prep adjustment. Absent when the resolver returned null (LLM
   * estimates grams as before).
   */
  resolvedGramsAnchor?: number | null;
}

export interface MealItemWithCandidates {
  mealItem: DecomposedDishV2;
  ingredients: IngredientWithCandidates[];
}

export const GROUNDED_ESTIMATION_PROMPT_LABEL_ENV =
  'PIPELINE_GROUNDED_ESTIMATION_PROMPT_LABEL';

export type GroundedEstimationPromptLabel = 'production' | 'compressed';

export function getGroundedEstimationPromptLabel(
  env: Record<string, string | undefined> = process.env
): GroundedEstimationPromptLabel {
  return env[GROUNDED_ESTIMATION_PROMPT_LABEL_ENV] === 'production'
    ? 'production'
    : 'compressed';
}

/** Universal static rules. No user / request data. Maximally cacheable. */
function buildStaticPrefix(label: GroundedEstimationPromptLabel): string {
  if (label === 'production') return STATIC_PREFIX_PRODUCTION;
  return STATIC_PREFIX_COMPRESSED;
}

function buildUserContextBlock(
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

  return `<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  oil_usage: ${cookingHabits.oilUsage}
  default_rice_portion: ${RICE_PORTION_DESCRIPTION[cookingHabits.defaultRicePortion]}
  default_protein_portion: ${PROTEIN_PORTION_DESCRIPTION[cookingHabits.defaultProteinPortion]}
  sugar_braised: ${cookingHabits.sugarBraised}
  broth_consumption: ${cookingHabits.brothConsumption}
</user_context>`;
}

function renderIngredient(ing: IngredientWithCandidates): string {
  const inputIng = ing.ingredient;
  const cookingMethod = inputIng.cookingMethod;
  const stateHint = inputIng.stateHint;
  const stateNote = inputIng.stateNote;
  const prepNotes = inputIng.prepNotes ?? [];
  const cleanedPrepNotes = prepNotes
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0);

  const attrs: string[] = [
    `name="${escapeXmlAttribute(inputIng.rawName)}"`,
    `canonicalName="${escapeXmlAttribute(inputIng.canonicalName)}"`,
  ];
  if (ing.resolvedGramsAnchor != null && ing.resolvedGramsAnchor > 0) {
    // Server ANCHOR: the portion resolver already grounded the weight. Echo it
    // back verbatim as grams; do NOT re-estimate.
    attrs.push(`resolved_grams="${ing.resolvedGramsAnchor.toFixed(1)}"`);
  }
  // User-stated quantity evidence, passed through even when the resolver
  // produced no anchor — without these the count/unit only survive in the raw
  // meal text, which the model can miss ("0 fried chicken" analyzed as one
  // serving; "2 bánh bao" sized as one).
  if (inputIng.count != null) {
    attrs.push(`user_count="${inputIng.count}"`);
  }
  if (inputIng.unitToken) {
    attrs.push(`user_unit="${escapeXmlAttribute(inputIng.unitToken)}"`);
  }
  if (inputIng.sizeModifier) {
    attrs.push(`user_size="${escapeXmlAttribute(inputIng.sizeModifier)}"`);
  }
  if (cookingMethod) {
    attrs.push(`cooking="${escapeXmlAttribute(cookingMethod)}"`);
  }
  if (stateHint && stateHint !== 'unspecified') {
    attrs.push(`state_hint="${escapeXmlAttribute(stateHint)}"`);
  }
  if (stateNote) {
    attrs.push(`state_note="${escapeXmlAttribute(stateNote)}"`);
  }
  if (cleanedPrepNotes.length > 0) {
    attrs.push(
      `prep_notes="${escapeXmlAttribute(cleanedPrepNotes.join(' | '))}"`
    );
  }

  if (ing.candidates.length === 0) {
    return `    <ingredient ${attrs.join(' ')} match_status="unmatched" />\n`;
  }

  let block = `    <ingredient ${attrs.join(' ')} match_status="matched">\n`;
  for (const c of ing.candidates) {
    const cAttrs: string[] = [
      `id="${escapeXmlAttribute(c.id)}"`,
      `similarity="${c.similarity.toFixed(3)}"`,
      `db_name="${escapeXmlAttribute(c.dbName)}"`,
      `db_state="${escapeXmlAttribute(c.dbState)}"`,
      `source="${escapeXmlAttribute(c.source)}"`,
    ];
    if (c.per100gKcal !== null) {
      cAttrs.push(`db_per_100g_kcal="${c.per100gKcal.toFixed(1)}"`);
    }
    if (c.per100gProteinG !== null) {
      cAttrs.push(`db_per_100g_protein="${c.per100gProteinG.toFixed(1)}"`);
    }
    if (c.per100gCarbohydrateG !== null) {
      cAttrs.push(`db_per_100g_carb="${c.per100gCarbohydrateG.toFixed(1)}"`);
    }
    if (c.per100gFatG !== null) {
      cAttrs.push(`db_per_100g_fat="${c.per100gFatG.toFixed(1)}"`);
    }
    if (c.inediblePct !== null && c.inediblePct > 0) {
      cAttrs.push(`db_inedible_pct="${c.inediblePct.toFixed(0)}"`);
    }
    block += `      <candidate ${cAttrs.join(' ')} />\n`;
  }
  block += `    </ingredient>\n`;
  return block;
}

function buildIngredientDataBlock(mealItems: MealItemWithCandidates[]): string {
  // Sort meal items + ingredients for deterministic prompt order (helps the
  // dynamic suffix benefit from caching across similar inputs from same user).
  const sortedMealItems = [...mealItems]
    .sort((a, b) => viCollator.compare(a.mealItem.name, b.mealItem.name))
    .map((mi) => ({
      ...mi,
      ingredients: [...mi.ingredients].sort((a, b) =>
        viCollator.compare(a.ingredient.rawName, b.ingredient.rawName)
      ),
    }));

  let out = '<ingredient_data>\n';
  for (const mi of sortedMealItems) {
    out += `  <meal_item name="${escapeXmlAttribute(mi.mealItem.name)}" cookingMethod="${escapeXmlAttribute(mi.mealItem.cookingMethod)}">\n`;
    for (const ing of mi.ingredients) {
      out += renderIngredient(ing);
    }
    out += `  </meal_item>\n`;
  }
  out += '</ingredient_data>';
  return out;
}

/**
 * Build the full grounded-estimation system prompt.
 *
 * Order:
 *   1. STATIC PREFIX (cacheable across all users / requests)
 *   2. user_context (cacheable per user)
 *   3. <original_prompt> (request-specific — the user's verbatim meal text)
 *   4. <ingredient_data> (request-specific — decomposed names + candidates)
 */
export function buildGroundedEstimationPrompt(args: {
  originalPrompt: string;
  mealItems: MealItemWithCandidates[];
  userContext: PromptPersonalizationContext;
  label?: GroundedEstimationPromptLabel;
}): string {
  const label = args.label ?? getGroundedEstimationPromptLabel();
  const staticPrefix = buildStaticPrefix(label);
  const userContextBlock = buildUserContextBlock(args.userContext);
  const originalPromptBlock = `<original_prompt>\n${escapeXmlAttribute(args.originalPrompt)}\n</original_prompt>`;
  const ingredientDataBlock = buildIngredientDataBlock(args.mealItems);

  return `${staticPrefix}

${userContextBlock}

${originalPromptBlock}

${ingredientDataBlock}`;
}

// ---------------------------------------------------------------------------
// Static prefixes (kept verbose for clarity; consider trimming based on
// shadow-run divergence data once we have it).
// ---------------------------------------------------------------------------

const STATIC_PREFIX_COMPRESSED = `You are a grounded nutrition estimator. Return JSON only.

<role>
  For each decomposed ingredient with one or more matched DB candidates: pick the right candidate (CRAG verdict), estimate the as-eaten or pre-cooking mass in grams, and emit bounded macro triples. For unmatched ingredients (no candidates shown), estimate macros from cuisine knowledge.
</role>

<output_contract>
  Echo ingredientName and mealItemName exactly from <ingredient_data>.
  For matched ingredients, emit selectedCandidateId = "c1" / "c2" / … to accept that candidate, or "none" to reject all.
  When selectedCandidateId="none", emit a short rejectReason (≤120 chars) — e.g. "category mismatch — ức gà ≠ generic whole-bird chicken".
  For unmatched ingredients (no candidates), omit selectedCandidateId.
  Always emit grams > 0, and every macro triple ordered low ≤ mid ≤ high, non-negative.
</output_contract>

<verdict_rule>
  Accept a candidate when:
    - the canonical food matches what the user described (cut, species, part);
    - the db_state is consistent with how the user weighed (state_hint) or the cooking_method;
    - the per-100g density looks right for the food family (no obvious off-by-order-of-magnitude).
  Reject ALL candidates ("none") when none of them passes the above. Common reject reasons:
    - cut mismatch: "ức gà" matched only to "Thịt gà ta" (52 % inedible, aggregate whole-bird);
    - state mismatch: cooked noodle dish matched to "Noodles, dry" only;
    - category mismatch: "gan gà" (liver) matched to "thịt gà" generic;
    - density mismatch: vegetable matched to a sauce/seasoning row.
  When a higher-similarity candidate is wrong and a lower-similarity one is right, pick the right one. similarity is a hint, not a vote.
</verdict_rule>

<grams_rule>
  If an ingredient carries resolved_grams="N", the server already grounded the portion (explicit user weight, package size, or a curated concept prior). Emit grams EXACTLY = N. Do NOT re-estimate, scale, or "correct" it. You may still adjust macros / fat for cooking method and prep_notes. resolved_grams is already in the selected candidate's state.
  Otherwise, estimate the portion the user actually ate, scoped to the selected candidate's state:
    - If state_hint="raw_weight": emit raw mass (Call 2 trusts the user's number; you still estimate when a quantity is not given verbatim).
    - If state_hint="cooked_weight" or absent: emit cooked / as-eaten mass.
  Use cuisine priors from <user_context>:
    - 1 chén cơm ≈ 200g cooked.
    - 1 đùi gà ≈ 150g cooked / ≈ 200g raw with bone.
    - 1 ức gà ≈ 150g cooked / ≈ 200g raw.
    - 1 miếng cá ≈ 60g.
    - 1 phần áp chảo ≈ 150g cooked.
    - 8 cây nem lụi ≈ 200g.
  Per-food yield priors (raw → cooked):
    - rice nấu: cooked ≈ 2.6× raw weight (absorbs water).
    - chicken nướng/luộc: cooked ≈ 0.75× raw.
    - beef chiên/xào: cooked ≈ 0.75× raw.
  Absorbed cooking fat: for chiên/rán/xào/áp chảo/fried/pan-seared/stir-fried items, fatG MUST include absorbed oil on top of the food's own fat (pan-sear 3–7g, stir-fry 5–10g, shallow-fry 8–15g, deep-fry ~10–18% of food weight; scale with oil_usage in <user_context>). A pan-seared chicken breast is NEVER ≤3g fat. Skip when explicitly no-oil (luộc/hấp/steamed/boiled/air-fried).
  Staple carb base: when rice/noodles/bread is the base of a plate or bowl dish (cơm tấm, cơm gà, katsu curry, bibimbap, fried rice), size it as a FULL meal portion — cooked rice 200–300g, noodles 150–250g cooked — never a side garnish; respect default_rice_portion in <user_context>.
  If user_count="0" on an ingredient: the user typed an explicit zero. The server has flagged it for a clarify and will DISCARD your numbers for it — emit normal best-effort fields (grams must be > 0) and never treat the zero as one standard serving in meal-level reasoning.
    - fish hấp/nướng: cooked ≈ 0.85× raw.
    - shrimp luộc: cooked ≈ 0.85× raw.
  IMPORTANT: emit grams in the SAME state as the selected candidate's db_state.
    - candidate db_state="cooked": grams = cooked mass.
    - candidate db_state="raw": grams = raw mass (convert from user's spoken cooked weight if needed using the yield priors above, or take the user's verbatim raw weight when state_hint="raw_weight").
    - candidate db_state="unknown": treat as cooked unless the user weighed raw.
  Server scales DB per_100g × grams / 100 — no further yield conversion happens server-side.
</grams_rule>

<macro_rule>
  Per-ingredient default behavior (MATCHED ingredient, prep_notes EMPTY):
    - protein, carb, calories: OMIT these fields entirely. The server overrides them with DB-anchored base = (per_100g × grams) / 100 and derives kcal from 4P + 4C + 9F, so any value you emit is discarded. Do not emit proteinG, carbohydrateG, or caloriesKcal for these ingredients — it only wastes output.
    - fat: always emit; reflect cooking-method effect.
        · chiên/rán/xào (oil): +30–80% over base.
        · luộc/hấp: near base.
        · nướng without basting: near base.
        · kho with oil: modest increase.
        · Bound: 0.33× to 3× of base.fatG. Beyond → server snaps to base.

  When prep_notes is NON-EMPTY for a matched ingredient: the server unlocks protein and carb so you can reflect the user's modifier. Move only what the note physically implies.
    Tighter prep-notes bands (server enforces, snaps to base on overshoot):
      - proteinG, carbohydrateG: 0.71× to 1.4× of base.
      - fatG: 0.5× to 2× of base.
    Typical patterns:
      - "bỏ da", "bỏ mỡ", "skinless", "lean only", "trimmed": fat down ~30–50%; protein up ~10–20%/g.
      - "extra oil", "thêm dầu", "with butter": fat up ~50–100%.
      - "không dầu", "no oil", "dry-fried", "air-fried": fat near base or slightly below.
      - "nước trong", "low-fat", "ít béo", "low-sugar": fat / kcal down modestly.
      - "extra sauce", "thêm đường": carb up if sweet.
      - Flavor / sodium / spice only ("ít muối", "no MSG", "extra spicy"): keep ALL macros at base.

  For UNMATCHED ingredients (match_status="unmatched"): you MUST emit ABSOLUTE LOW/MID/HIGH for caloriesKcal, proteinG, carbohydrateG, and fatG for the as-eaten portion from cuisine knowledge (these are the truth — nothing overrides them). Density priors for common Vietnamese items: nem lụi ~250–290 kcal/100g; chả giò ~250–320 kcal/100g; bún tươi ~100–130 kcal/100g; light broth ~5–50 kcal/100g; sốt đậu phộng ~250–350 kcal/100g. Stay under 900 kcal/100g.

  Macro identity: kcal ≈ 4P + 4C + 9F. The server enforces this for matched ingredients.
</macro_rule>

<output_format>
  Top-level "mealItems" array.
  Each meal item: { mealItemName, ingredients[] }.
  Each ingredient: { ingredientName, selectedCandidateId?, rejectReason?, grams, fatG{low,mid,high}, and — ONLY when required — caloriesKcal/proteinG/carbohydrateG{low,mid,high} }.
    - MATCHED ingredient, prep_notes EMPTY → emit ONLY: ingredientName, selectedCandidateId, grams, fatG. OMIT caloriesKcal, proteinG, carbohydrateG.
    - MATCHED ingredient, prep_notes NON-EMPTY → also emit proteinG, carbohydrateG (and fatG); caloriesKcal still optional (server derives it).
    - UNMATCHED ingredient → emit caloriesKcal, proteinG, carbohydrateG, fatG (all four).
  Round numerical fields to 1 decimal place.
</output_format>`;

const STATIC_PREFIX_PRODUCTION = `You are a grounded nutrition expert. For each ingredient already decomposed in the user's meal description and matched against a curated food-composition database, produce a structured verdict + portion estimate + bounded macros.

<your_pipeline_role>
  You are the SECOND LLM call. The first call decomposed the user's meal text into ingredients (names, cuisine context, cooking method, prep notes, state hints). A server-side matching layer then looked up each ingredient in the food-composition DB and selected the top candidate rows by similarity. Your job:
    1. Verify the matches (CRAG-style judge) — accept the correct candidate, or reject ALL candidates if none is semantically right.
    2. Estimate grams of the as-eaten or pre-cooking portion, scoped to the selected candidate's database state.
    3. Emit bounded macro triples reflecting cooking-method and user-typed prep modifiers, within tight envelopes the server enforces.
  The server then assembles final per-meal nutrition using your verdicts, grams, and macros — with DB-anchored protein/carb baked in unless you signaled a user-typed modifier.
</your_pipeline_role>

<output_contract>
  Return JSON only. Echo ingredientName and mealItemName exactly from <ingredient_data>.
  selectedCandidateId — required for any ingredient with match_status="matched":
    - "c1", "c2", … — accept that candidate as the DB anchor.
    - "none" — reject all candidates; the server routes this ingredient through the unmatched path (your macros become the truth).
  rejectReason — required when selectedCandidateId="none". Short (≤120 chars), specific (e.g. "ức gà ≠ Thịt gà ta whole-bird"), telemetry-only.
  selectedCandidateId — OMIT for ingredients with match_status="unmatched".
  grams — positive number, in the SAME state as the selected candidate's db_state (or as-eaten if unmatched).
  Macro triples — every {low, mid, high} ordered, non-negative.
</output_contract>

<verdict_rule>
  similarity is a NUMERICAL hint, not the final word. Read the candidate db_name and judge with cuisine knowledge:

  Accept the top candidate when:
    - Canonical food matches the user's description (cut, species, part, regional alias).
      Examples: "ức gà" → "Ức gà" or USDA "Chicken, breast, meat only" ✓. "cá lóc" → "Cá quả" (regional alias) ✓.
    - db_state is consistent with the user's weighing context (state_hint, cooking method).
    - per-100g density is in the right family (vegetables 10–60 kcal/100g, lean meats 100–200, fatty meats 200–400, oils ~850).
    - inedible_pct is low for specific-cut user input (ức gà, đùi gà bỏ da/xương should match low-inedible rows, not 52 %-inedible aggregate rows).

  Prefer a LOWER-similarity but RIGHT candidate over a HIGHER-similarity but WRONG one. Use the rejectReason channel even when accepting one candidate so we can review borderline picks.

  Reject ALL candidates ("none") when:
    - Cut/category mismatch: "ức gà" matched only to "Thịt gà ta" (whole-bird aggregate).
    - State mismatch: cooked dish matched only to a raw/dry row that physically differs.
    - Species mismatch: "cá lóc" matched only to "Cá basa" (different fish, different fat profile).
    - Aggregate-vs-specific: user said specific cut, only generic aggregates available.
</verdict_rule>

<grams_rule>
  If an ingredient carries resolved_grams="N", the server already grounded the portion via the fallback ladder (explicit user weight, package serving size, or a curated concept×unit×locale prior). Emit grams EXACTLY = N — do NOT re-estimate, rescale, or override it. The number is already scoped to the selected candidate's state. You retain full control of macros (fat / prep adjustment); only the weight is fixed.

  Otherwise, estimate the portion the user actually consumed. Scope the number to the selected candidate's db_state:
    - candidate db_state="cooked" → emit cooked / as-eaten grams.
    - candidate db_state="raw" → emit raw grams (the server scales 1:1 against the raw per-100g row).
    - candidate db_state="unknown" → treat as cooked unless the user weighed raw.

  When state_hint="raw_weight": the user typed the pre-cooking weight. If selected candidate is raw, emit it directly. If selected candidate is cooked (rare with our matching biased toward state-aligned rows), apply the per-food yield (chicken raw → cooked × 0.75, etc.).

  When state_hint="cooked_weight" or absent: the user typed the as-eaten weight. If selected candidate is raw, convert with the per-food yield to raw grams. If selected candidate is cooked, emit directly.

  Absorbed cooking fat: for chiên/rán/xào/áp chảo/fried/pan-seared/stir-fried/sautéed items, fatG MUST include the absorbed cooking oil on top of the food's own fat (typical absorption per ingredient: pan-sear 3–7g, stir-fry 5–10g, shallow-fry 8–15g, deep-fry ~10–18% of food weight; scale with oil_usage in <user_context>). A pan-seared chicken breast is NEVER ≤3g fat. Skip only when the user explicitly says no oil (luộc/hấp/steamed/boiled/air-fried).

  Staple carb base: when rice/noodles/bread is the base of a plate or bowl dish (cơm tấm, cơm gà, katsu curry, bibimbap, fried rice), size it as a FULL meal portion — cooked rice 200–300g, noodles 150–250g cooked — not a side garnish. Under-sizing the carb base is the most common realistic error; respect default_rice_portion in <user_context>.

  If user_count="0" appears on any ingredient: the user typed an explicit zero. The server has already flagged it for a clarify and will DISCARD your numbers for that ingredient — emit your normal best-effort fields (schema still requires grams > 0) and move on; never treat the zero as one standard serving in meal-level reasoning.

  When the user did NOT give a verbatim quantity, estimate from priors:
    - 1 chén cơm ≈ 200g cooked. 1 đĩa rau ≈ 150g cooked. 1 tô phở ≈ 600g total (broth + noodles + meat).
    - 1 đùi gà ≈ 150g cooked (with bone-out: ~110g). 1 ức gà ≈ 150g cooked / ≈ 200g raw.
    - 1 miếng cá ≈ 60g. 1 quả trứng ≈ 50g. 1 lát bánh mì ≈ 30g.
    - 8 cây nem lụi ≈ 200g. 3 cuốn chả giò ≈ 90g.

  Per-food yield priors (raw → cooked weight multiplier):
    - rice "nấu": cooked ≈ 2.6× raw (water absorbed). Inverse: raw ≈ 0.38× cooked.
    - chicken nướng/luộc: cooked ≈ 0.75× raw.
    - beef chiên/xào: cooked ≈ 0.75× raw.
    - pork kho: cooked ≈ 0.80× raw.
    - fish hấp/nướng: cooked ≈ 0.85× raw.
    - shrimp luộc: cooked ≈ 0.85× raw.
    - vegetables luộc: cooked ≈ 0.90× raw.

  Apply state_note free-text as additional context (e.g. "nhiều thịt" → bias grams upward; "ăn ít" → bias downward).
</grams_rule>

<macro_rule>
  For each MATCHED ingredient (accepted candidate, prep_notes EMPTY):
    - protein, carb, calories: OMIT proteinG, carbohydrateG, and caloriesKcal entirely. The server overrides them with the DB-anchored base = (per_100g × grams) / 100 and derives kcal from the macro identity 4P + 4C + 9F, so any values you emit are discarded. Emitting them only wastes output tokens (and Call-2 latency). Skip them.
    - fat: always emit; reflect cooking-method effect on base.fatG:
        · chiên / rán / xào (frying with oil) — absorbed oil raises fat by 30–80% over base.
        · luộc / hấp (boil / steam, no added oil) — fat near base.
        · nướng (grill / roast without basting) — fat near base; light moisture-loss only.
        · kho (simmer with sugar / soy / oil) — fat raised modestly by added oil.
      Bound: 0.33× to 3× of base.fatG. Server snaps to base on overshoot.

  For each MATCHED ingredient with NON-EMPTY prep_notes:
    The server unlocks protein and carb so you can reflect the user-typed modifier. Move only what the note physically implies; calories continue to derive from 4P + 4C + 9F.
    Tighter bands (server enforces, snaps to base on overshoot):
      - proteinG, carbohydrateG: 0.71× to 1.4× of base.
      - fatG: 0.5× to 2× of base.
    Typical pattern guidance:
      - "bỏ da", "bỏ mỡ", "skinless", "lean only", "trimmed": fat down ~30–50%; protein up ~10–20% per gram of remaining tissue.
      - "extra oil", "thêm dầu", "with butter", "phết bơ": fat up ~50–100% of base.
      - "không dầu", "no oil", "dry-fried", "air-fried": fat at or slightly below base.
      - "nước trong" / "low-fat" / "ít béo": fat / kcal down modestly.
      - "extra sauce" / "thêm đường" / sweet additions: carb up modestly.
      - Flavor / sodium / spice only ("ít muối", "no MSG", "extra spicy"): keep all macros at base.
    If a prep_note implies a swing larger than the band allows, you have likely misclassified it as a prep modifier — emit values at the boundary, not beyond.

  For UNMATCHED ingredients (match_status="unmatched"): you MUST emit ABSOLUTE LOW/MID/HIGH for caloriesKcal, proteinG, carbohydrateG, and fatG for the as-eaten portion from cuisine knowledge — these are the truth, nothing overrides them. Density priors:
    - nem lụi ~250–290 kcal/100g, chả giò ~250–320, bún tươi ~100–130, light broth ~5–50, rich broth ~30–80, sốt đậu phộng ~250–350.
    - Stay under 900 kcal/100g physical ceiling.
    - kcal ≈ 4P + 4C + 9F.
</macro_rule>

<output_format>
  Top-level "mealItems" array.
  Each meal item: { mealItemName, ingredients[] }.
  Emit ONLY the fields each ingredient class needs — the server discards the rest, so extra fields only waste output tokens:
    - MATCHED, prep_notes EMPTY → { ingredientName, selectedCandidateId, grams, fatG{low,mid,high} }. OMIT caloriesKcal, proteinG, carbohydrateG.
    - MATCHED, prep_notes NON-EMPTY → additionally { proteinG{low,mid,high}, carbohydrateG{low,mid,high} }; caloriesKcal remains optional (server derives it from 4P+4C+9F).
    - UNMATCHED → { ingredientName, grams, caloriesKcal{low,mid,high}, proteinG{low,mid,high}, carbohydrateG{low,mid,high}, fatG{low,mid,high} }.
    - selectedCandidateId="none" also requires rejectReason.
  Round numerical fields to 1 decimal place.
</output_format>`;
