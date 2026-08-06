import { RICE_PORTION_DESCRIPTION } from '../constants';
import { PORTION_PRIORS } from '../portion/priors';

const PRIOR_LABELS: Record<string, string> = {
  'banh-bao': 'bánh bao',
  'quail-egg': 'trứng cút',
  'banh-mi-loaf': 'lát/ổ bánh mì',
  'cooked-rice': 'chén/bát cơm',
  'chicken-breast': 'ức gà',
  'chicken-thigh': 'đùi gà',
  'fish-piece': 'miếng cá',
  'nem-lui': 'cây nem lụi',
  'pan-seared-protein-serving': 'phần protein áp chảo',
};

export function renderPriorLines(): string {
  return PORTION_PRIORS.map(({ conceptId, perUnit, promptLabel }) => {
    const label = promptLabel ?? PRIOR_LABELS[conceptId] ?? conceptId;
    return `    - 1 ${label} ≈ ${perUnit.mid}g (${perUnit.low}–${perUnit.high}g).`;
  }).join('\n');
}

const VESSEL_RULE = `

<vessel_rule>
  When a <meal_item> carries serve_total_guard_g="L-H": the SERVED total of that dish — every ingredient at full serving with broth/liquid at 100% — must land inside [L, H] grams. resolved_grams anchors and explicit user weights are AUTHORITATIVE: never rescale them; fit the band by adjusting only non-anchored ingredients. If the anchored ingredients alone already exceed the band, the band yields — anchors always win; never distort other ingredients to compensate for an over-band anchored total. EATEN vs SERVED: emit grams for what was EATEN — solids fully eaten; broth/liquid grams = served broth × broth_consumption from <user_context> (leave_it ≈ 10%, some ≈ 50%, finish_it = 100%). The eaten total may fall below the band when broth is not drunk; the SERVED total must still be plausible for the vessel. Portion cues on ingredients shift within the band: ít/little ≈ −30%, nhiều/extra ≈ +40%, nửa/half = ×0.5.
</vessel_rule>`;

export function buildStaticPrefix(hasVessel = false): string {
  const vesselRule = hasVessel ? VESSEL_RULE : '';
  return `You are a grounded nutrition estimator. Return JSON only.

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
    - the db_state has a workable relationship to the dish: identical, or convertible. A dry/raw staple row backing a cooked dish (dried noodles for "1 tô mì gói", raw rice for "1 chén cơm") is the NORMAL case, NOT a state mismatch — accept it and emit grams in its basis per the grams_rule.
    - the per-100g density looks right for the food family (no obvious off-by-order-of-magnitude).
  Reject ALL candidates ("none") when none of them passes the above. Common reject reasons:
    - cut mismatch: "ức gà" matched only to "Thịt gà ta" (52 % inedible, aggregate whole-bird);
    - category mismatch: "gan gà" (liver) matched to "thịt gà" generic;
    - density mismatch: vegetable matched to a sauce/seasoning row.
  When a higher-similarity candidate is wrong and a lower-similarity one is right, pick the right one. similarity is a hint, not a vote.
</verdict_rule>

<grams_rule>
  If an ingredient carries resolved_grams="N", the server already grounded the portion (explicit user weight, package size, or a curated concept prior). Emit grams EXACTLY = N. Do NOT re-estimate, scale, or "correct" it. You may still adjust macros / fat for cooking method and prep_notes. resolved_grams is already in the selected candidate's state.
  Otherwise, estimate the portion the user actually ate. BASIS RULE — overrides every other sizing hint in this section: emit grams in the SAME state as the selected candidate's db_state.
    - db_state="cooked": grams = cooked / as-eaten mass.
    - db_state="raw" (includes DRY staples: dried noodles, raw rice, dry beans): grams = raw/dry mass. Convert from the as-eaten portion using the cooking yields you know (meat loses water when cooked; dried staples absorb it, ending ~2.5–3× heavier). Cross-check with db_per_100g_kcal: grams × density must give a plausible total for the dish — a dry-basis row (~350–450 kcal/100g) carrying a cooked-basis mass reads 2–3× too high.
    - db_state="unknown": treat as cooked unless the user weighed raw.
  state_hint describes the USER's number, never the basis you emit: "raw_weight" means their figure is already raw (trust it verbatim); "cooked_weight" or absent means the figure is as-eaten — convert it when the row's basis differs.
  For soups, vessel or not, broth/liquid grams follow broth_consumption in <user_context>: leave_it ≈ 10%, some ≈ 50%, finish_it = 100% of served broth.
  Use cuisine priors:
${renderPriorLines()}
  Absorbed cooking fat: for chiên/rán/xào/áp chảo/fried/pan-seared/stir-fried items, fatG MUST include absorbed oil on top of the food's own fat (pan-sear 3–7g, stir-fry 5–10g, shallow-fry 8–15g, deep-fry ~10–18% of food weight; scale with oil_usage in <user_context>). A pan-seared chicken breast is NEVER ≤3g fat. Skip when explicitly no-oil (luộc/hấp/steamed/boiled/air-fried).
  Staple carb base: when rice/noodles/bread is the base of a plate or bowl dish (cơm tấm, cơm gà, katsu curry, bibimbap, fried rice), size it as a FULL meal portion — rice follows default_rice_portion in <user_context> (${RICE_PORTION_DESCRIPTION.small}; ${RICE_PORTION_DESCRIPTION.medium}; ${RICE_PORTION_DESCRIPTION.large}); noodles are typically 150–250g cooked — never a side garnish. (An as-eaten figure — the BASIS RULE still applies when the matched row is dry/raw.)
  When a protein has no count/unit/anchor, size it per default_protein_portion in <user_context>.
  For kho/braised/caramelized dishes, added sugar follows sugar_braised in <user_context> (low ≈ 5g, medium ≈ 10–15g, high ≈ 20–25g carbs from sugar per serving).
  If user_count="0" on an ingredient: the user typed an explicit zero. The server has flagged it for a clarify and will DISCARD your numbers for it — emit normal best-effort fields (grams must be > 0) and never treat the zero as one standard serving in meal-level reasoning.
  Server scales DB per_100g × grams / 100 — no further yield conversion happens server-side.
</grams_rule>${vesselRule}

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
}
