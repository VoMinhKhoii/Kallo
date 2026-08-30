/**
 * Verbatim static prefix of the V2 Call-2 grounded-estimation prompt — the
 * universal rules, identical bytes across every user and request. The
 * request-specific blocks are assembled in `build/grounded-estimation.ts`.
 * Changing a single character here changes model output.
 */

import {
  isPromptSizingHintsEnabled,
  isProteinPortionDefaultEnabled,
  isVesselGuardEnabled,
} from '@/lib/ai/pipeline/config/prompt-ablation-flags';
import { PORTION_PRIORS } from '@/lib/ai/portion/data/priors';
import type { PromptLocale } from '@/lib/ai/prompts/locale';
import { RICE_PORTION_DESCRIPTION } from '@/lib/ai/prompts/text/portion-descriptions';
import { renderAbsorbedOilPromptRule } from '@/lib/domain/nutrition/absorbed-oil';

export type EstimationPromptLocale = PromptLocale;

const PRIOR_LABELS: Record<string, string> = {
  'banh-bao': 'bánh bao',
  'quail-egg': 'trứng cút',
  'banh-mi-loaf': 'lát/ổ bánh mì',
  'cooked-rice': 'chén/bát cơm',
  'chicken-breast': 'ức gà',
  'nem-lui': 'cây nem lụi',
  'pan-seared-protein-serving': 'phần protein áp chảo',
};

/**
 * English prior labels for the global prompt variant, keyed by the prior's
 * promptLabel when set, otherwise its conceptId. Basis qualifiers
 * ("cả xương"/bone-in) MUST survive translation — they mark gross-as-served
 * priors.
 */
const PRIOR_LABELS_GLOBAL: Record<string, string> = {
  'banh-bao': 'steamed bun (bánh bao)',
  'quail-egg': 'quail egg',
  'lát bánh mì': 'slice of bread',
  'ổ bánh mì': 'small baguette loaf (bread only)',
  'cooked-rice': 'rice bowl (cooked)',
  'chicken-breast': 'chicken breast fillet',
  'miếng sườn (cả xương)': 'rib piece (bone-in)',
  'cánh gà (cả xương)': 'chicken wing (bone-in)',
  'đùi gà (cả xương)': 'chicken thigh/drumstick (bone-in)',
  'con cá nguyên (cả đầu/xương)': 'whole fish (head/bones on)',
  'khúc/khoanh cá (còn xương)': 'fish steak/section (bone-in)',
  'miếng cá phi lê (không xương)': 'fish fillet (boneless)',
  'con tôm nguyên vỏ': 'shell-on shrimp',
  'con tôm đã bóc vỏ': 'peeled shrimp',
  'con cua/ghẹ nguyên (cả vỏ)': 'whole crab (shell-on)',
  'phần thịt cua/ghẹ đã gỡ': 'picked crab meat',
  'quả trứng còn vỏ': 'egg in shell',
  'quả trứng luộc đã bóc vỏ': 'peeled boiled egg',
  'nem-lui': 'nem lụi skewer',
  'pan-seared-protein-serving': 'pan-seared protein serving',
  'gói mì': 'instant-noodle packet (dry)',
};

export function renderPriorLines(
  locale: EstimationPromptLocale = 'vi'
): string {
  const render = ({
    conceptId,
    perUnit,
    promptLabel,
  }: (typeof PORTION_PRIORS)[number]): string => {
    const viLabel = promptLabel ?? PRIOR_LABELS[conceptId] ?? conceptId;
    const label =
      locale === 'global'
        ? (PRIOR_LABELS_GLOBAL[promptLabel ?? conceptId] ?? viLabel)
        : viLabel;
    return `    - 1 ${label} ≈ ${perUnit.mid}g (${perUnit.low}–${perUnit.high}g).`;
  };

  return PORTION_PRIORS.map(render).join('\n');
}

/**
 * Fallback kcal-density anchors for UNMATCHED ingredients, per locale. The
 * shared "Stay under 900 kcal/100g" cap follows in the template.
 */
const DENSITY_PRIORS: Record<EstimationPromptLocale, string> = {
  vi: 'Density priors for common Vietnamese items: nem lụi ~250–290 kcal/100g; chả giò ~250–320 kcal/100g; bún tươi ~100–130 kcal/100g; light broth ~5–50 kcal/100g; sốt đậu phộng ~250–350 kcal/100g.',
  global:
    'Density priors for common items: pizza slice ~250–300 kcal/100g; french fries ~290–330 kcal/100g; beef burger patty ~250–290 kcal/100g; cooked pasta ~130–160 kcal/100g; creamy dressings/sauces ~300–450 kcal/100g; light broth ~5–50 kcal/100g.',
};

const REFUSE_VESSEL_RULE = `

<vessel_rule>
  When a <meal_item> carries serve_total_guard_g="L-H": the SERVED EDIBLE total of that dish — every ingredient's grossG after refusePct, with broth/liquid at 100% — must land inside [L, H] grams. resolved_grams anchors and explicit user weights are AUTHORITATIVE EDIBLE mass: never rescale them; fit the band by adjusting only non-anchored ingredients. If the anchored ingredients alone already exceed the band, the band yields — anchors always win; never distort other ingredients to compensate for an over-band anchored total. EATEN vs SERVED: macro triples cover what was EATEN — solids fully eaten; broth/liquid mass = served broth × broth_consumption from <user_context> (leave_it ≈ 10%, some ≈ 50%, finish_it = 100%). The eaten total may fall below the band when broth is not drunk; the SERVED total must still be plausible for the vessel. Portion cues on ingredients shift within the band: ít/little ≈ −30%, nhiều/extra ≈ +40%, nửa/half = ×0.5.
</vessel_rule>`;

export function buildStaticPrefix(
  hasVessel = false,
  locale: EstimationPromptLocale = 'vi'
): string {
  const sizingHintsEnabled = isPromptSizingHintsEnabled();
  const vesselRule =
    hasVessel && isVesselGuardEnabled() ? REFUSE_VESSEL_RULE : '';
  const cuisinePriors = sizingHintsEnabled
    ? `  Use cuisine priors:\n${renderPriorLines(locale)}\n`
    : '';
  const stapleCarbRule = sizingHintsEnabled
    ? `  Staple carb base: when rice/noodles/bread is the base of a plate or bowl dish (cơm tấm, cơm gà, katsu curry, bibimbap, fried rice), size it as a FULL meal portion — rice follows default_rice_portion in <user_context> (${RICE_PORTION_DESCRIPTION.small}; ${RICE_PORTION_DESCRIPTION.medium}; ${RICE_PORTION_DESCRIPTION.large}); noodles are typically 150–250g cooked — never a side garnish. (An as-eaten figure — the BASIS RULE still applies when the matched row is dry/raw.)\n`
    : '';
  const proteinPortionRule =
    sizingHintsEnabled && isProteinPortionDefaultEnabled()
      ? '  When a protein has no count/unit/anchor, size it per default_protein_portion in <user_context>.\n'
      : '';
  const roleMass = 'estimate the whole as-served mass and its inedible share';
  const outputMassContract =
    'Always emit grossG > 0 and integer refusePct from 0–80 (explicit 0 for boneless/shell-off foods), and every macro triple ordered low ≤ mid ≤ high, non-negative.';
  const gramsRule = `  If an ingredient carries resolved_grams="N", N is AUTHORITATIVE EDIBLE mass (explicit user weight, package size, or an edible-basis curated concept prior). Emit grossG and refusePct consistent with edible mass N; the server retains N as the anchor. Do NOT re-estimate, scale, or "correct" N. You may still adjust macros / fat for cooking method and prep_notes. Gross PORTION_PRIORS use basis-explicit labels such as "cả xương"/"nguyên vỏ"; the server retains their gross anchor and performs the one refuse deduction.
  If an ingredient carries user_mass_g="N" with mass_basis="gross_as_served", N is AUTHORITATIVE grossG; emit grossG=N and estimate refusePct. With mass_basis="edible", resolved_grams is authoritative. With mass_basis="unknown", infer conservatively from the named physical form.
  Otherwise, estimate the portion served. BASIS RULE — overrides every other sizing hint in this section: grossG is the WHOLE piece as served, INCLUDING bone/shell/skin/rind not eaten, in the SAME state as the selected candidate's db_state. refusePct is the integer share of grossG that is inedible; boneless/shell-off foods MUST emit 0. The SERVER computes edible mass = grossG × (1 − refusePct/100); never emit edibleG.
    - db_state="cooked": grossG = cooked / as-served whole mass.
    - db_state="raw" (includes DRY staples: dried noodles, raw rice, dry beans): grossG = raw/dry whole mass. Convert from the as-served portion using the cooking yields you know (meat loses water when cooked; dried staples absorb it, ending ~2.5–3× heavier). Cross-check edible mass with db_per_100g_kcal: edibleG × density must give a plausible total for the dish — a dry-basis row (~350–450 kcal/100g) carrying a cooked-basis mass reads 2–3× too high.
    - db_state="unknown": treat as cooked unless the user weighed raw.
  Refuse anchors: rib ≈ 40–60%; wing ≈ 30–50%; whole fish ≈ 35–50%; fish steak/section ≈ 15–30%; shell-on shrimp ≈ 35–55%; whole crab ≈ 55–75%; egg still in shell ≈ 10–15%; bone-in thigh/drumstick ≈ 25–35%; bare stock/soup bones (xương heo/bò/gà, xương ống, cục xương) ≈ 50–75% — only clinging meat and marrow are edible, and a candidate named "chỉ lấy phần nạc"/"separable lean only" still describes edible flesh per 100 g, so grossG stays the whole bone-in mass with a matching nonzero refusePct; boneless/peeled/picked/shell-off = 0.
  db_inedible_pct, when present on a candidate, is the DB row's measured inedible share for its own physical form. Still emit your independent refusePct estimate so both can be compared in telemetry. The server does NOT use db_inedible_pct in arithmetic unless a future row-level physical-form tag proves it compatible with the served form.`;
  const zeroMassContract =
    'emit normal best-effort fields (grossG must be > 0 and refusePct is required)';
  const serverScalingRule =
    '  Server scales DB per_100g × edible mass / 100 after applying the accepted candidate override / refuse clamp — no further yield conversion happens server-side.';
  const outputIngredient =
    '  Each ingredient: { ingredientName, selectedCandidateId?, rejectReason?, grossG, refusePct, caloriesKcal{low,mid,high}, proteinG{low,mid,high}, carbohydrateG{low,mid,high}, fatG{low,mid,high} }.';
  const finalBasisRule =
    "    - grossG MUST be in the SELECTED candidate's db_state basis and include the whole served piece; refusePct carries the inedible share. Dry/raw row → dry/raw grossG.";
  const verdictMassField = 'grossG';
  const matchedMacroRule =
    '    - protein, carb, calories: emit your best estimate for the EDIBLE portion (grossG after refusePct), but know the server OVERRIDES them with DB-anchored base = (per_100g × edible mass) / 100 and derives kcal from 4P + 4C + 9F — keep these three brief (flat triples are fine); your effort belongs in grossG, refusePct, and fat.';
  const finalSanityRule =
    '    - Sanity-check: edible mass × db_per_100g_kcal / 100 must be a believable kcal for that ingredient. ~250g edible against a ~440 kcal/100g dry-noodle row is ~1100 kcal — wrong basis; the dry packet is ~80g.';
  // Global-locale users get candidates with a paired English name; without
  // this note the verdict reads only the Vietnamese db_name and misses
  // disqualifiers ("roll", "breaded", "deli") for a plain-cut query. The vi
  // variant stays byte-identical (empty string).
  const verdictLocaleNote =
    locale === 'global'
      ? '\n  db_name is the row\'s Vietnamese name; db_name_en (when present) is the SAME row\'s English name — judge food identity using both. Reject processed variants (roll, breaded, deli, canned, luncheon) when the user described a plain cut or dish ("chicken breast" ≠ "Chicken breast, roll, oven-roasted").'
      : '';
  return `You are a grounded nutrition estimator. Return JSON only.

<role>
  For each decomposed ingredient with one or more matched DB candidates: pick the right candidate (CRAG verdict), ${roleMass}, and emit bounded macro triples. For unmatched ingredients (no candidates shown), estimate macros from cuisine knowledge.
</role>

<output_contract>
  Echo ingredientName and mealItemName exactly from <ingredient_data>.
  For matched ingredients, emit selectedCandidateId = "c1" / "c2" / … to accept that candidate, or "none" to reject all.
  When selectedCandidateId="none", emit a short rejectReason (≤120 chars) — e.g. "category mismatch — ức gà ≠ generic whole-bird chicken".
  For unmatched ingredients (no candidates), omit selectedCandidateId.
  ${outputMassContract}
</output_contract>

<verdict_rule>
  Accept a candidate when:
    - the canonical food matches what the user described (cut, species, part);
    - the db_state has a workable relationship to the dish: identical, or convertible. A dry/raw staple row backing a cooked dish (dried noodles for "1 tô mì gói", raw rice for "1 chén cơm") is the NORMAL case, NOT a state mismatch — accept it and emit ${verdictMassField} in its basis per the grams_rule.
    - the per-100g density looks right for the food family (no obvious off-by-order-of-magnitude).
  Reject ALL candidates ("none") when none of them passes the above. Common reject reasons:
    - cut mismatch: "ức gà" matched only to "Thịt gà ta" (52 % inedible, aggregate whole-bird);
    - category mismatch: "gan gà" (liver) matched to "thịt gà" generic;
    - density mismatch: vegetable matched to a sauce/seasoning row.
  When a higher-similarity candidate is wrong and a lower-similarity one is right, pick the right one. similarity is a hint, not a vote.${verdictLocaleNote}
</verdict_rule>

<grams_rule>
${gramsRule}
  state_hint describes the USER's number, never the basis you emit: "raw_weight" means their figure is already raw (trust it verbatim); "cooked_weight" or absent means the figure is as-eaten — convert it when the row's basis differs.
  For soups, vessel or not, broth/liquid grams follow broth_consumption in <user_context>: leave_it ≈ 10%, some ≈ 50%, finish_it = 100% of served broth.
${cuisinePriors}  Absorbed cooking fat: for chiên/rán/xào/áp chảo/fried/pan-seared/stir-fried items, the cooking oil MUST be counted exactly ONCE.
    - If the ingredient list ALREADY contains the cooking fat as its own entry (dầu ăn, dầu, mỡ, oil, butter, ghee, lard): that row carries the entire oil. Every OTHER ingredient in the dish keeps fatG at its own natural fat — do NOT also add absorbed oil to them, or the same oil is counted twice.
    - Only when NO such row exists may you fold absorbed oil into the fried food's fatG (${renderAbsorbedOilPromptRule()}; scale within the range using oil_usage in <user_context>). A pan-seared chicken breast is NEVER ≤3g fat.
    - Skip entirely when explicitly no-oil (luộc/hấp/steamed/boiled/air-fried).
${stapleCarbRule}${proteinPortionRule}  For kho/braised/caramelized dishes, added sugar follows sugar_braised in <user_context> (low ≈ 5g, medium ≈ 10–15g, high ≈ 20–25g carbs from sugar per serving).
  If user_count="0" on an ingredient: the user typed an explicit zero. The server has flagged it for a clarify and will DISCARD your numbers for it — ${zeroMassContract} and never treat the zero as one standard serving in meal-level reasoning.
${serverScalingRule}
</grams_rule>${vesselRule}

<macro_rule>
  Every ingredient ALWAYS emits all four macro triples (caloriesKcal, proteinG, carbohydrateG, fatG). A genuine 0 is a valid value — never invent mass to avoid a zero, and never omit a field.

  Per-ingredient default behavior (MATCHED ingredient, prep_notes EMPTY):
${matchedMacroRule}
    - fat: reflect cooking-method effect.
        · chiên/rán/xào (oil): +30–80% over base.
        · luộc/hấp: near base.
        · nướng without basting: near base.
        · kho with oil: modest increase.
        · Server floor: base.fatG / 3. Server ceiling: base.fatG × 3 + the
          absorbed-oil allowance above. Beyond → server clamps the whole
          triple to the nearest bound while preserving its spread.

  When prep_notes is NON-EMPTY for a matched ingredient: the server unlocks protein and carb, so those two triples now carry real signal — reflect the user's modifier. Move only what the note physically implies.
    Tighter prep-notes bands (server clamps to the nearest bound):
      - proteinG, carbohydrateG: 0.71× to 1.4× of base.
      - fatG floor: 0.5× base; ceiling: 2× base + the absorbed-oil allowance
        above (zero for no-oil methods).
    Typical patterns:
      - "bỏ da", "bỏ mỡ", "skinless", "lean only", "trimmed": fat down ~30–50%; protein up ~10–20%/g.
      - "extra oil", "thêm dầu", "with butter": fat up ~50–100%.
      - "không dầu", "no oil", "dry-fried", "air-fried": fat near base or slightly below.
      - "nước trong", "low-fat", "ít béo", "low-sugar": fat / kcal down modestly.
      - "extra sauce", "thêm đường": carb up if sweet.
      - Flavor / sodium / spice only ("ít muối", "no MSG", "extra spicy"): keep ALL macros at base.

  For UNMATCHED ingredients (match_status="unmatched"): you MUST emit ABSOLUTE LOW/MID/HIGH for caloriesKcal, proteinG, carbohydrateG, and fatG for the as-eaten portion from cuisine knowledge (these are the truth — nothing overrides them). ${DENSITY_PRIORS[locale]} Stay under 900 kcal/100g.

  Macro identity: kcal ≈ 4P + 4C + 9F. The server enforces this for matched ingredients.
</macro_rule>

<output_format>
  Top-level "mealItems" array.
  Each meal item: { mealItemName, ingredients[] }.
${outputIngredient}
  All four macro triples are REQUIRED on every ingredient, matched or not. 0 is a valid value; an omitted field is a schema violation and the whole response is rejected.
  Round numerical fields to 1 decimal place.

  FINAL CHECK before emitting, ingredient by ingredient — the BASIS RULE again, because getting it wrong is a silent 2–3× calorie error:
${finalBasisRule}
    - If the user stated a weight, state_hint says which basis THEIR number is in — convert it whenever the candidate's basis differs; never copy it across bases.
${finalSanityRule}
</output_format>`;
}
