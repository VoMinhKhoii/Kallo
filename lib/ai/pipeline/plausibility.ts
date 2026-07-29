/**
 * Per-ingredient plausibility classification for the v2 grounded pipeline.
 *
 * Phase 1 replaces the silent-zero mechanism (grams=1, kcal=0 rows) with an
 * explicit classification so the completeness gates can decide whether a
 * result is safe to persist or must trigger a clarify round-trip.
 *
 * The four classes:
 *   - 'ok'                       — resolved with a sensible portion + nutrition.
 *   - 'genuinely_noncaloric'     — water, black coffee, plain tea. Near-zero
 *                                  kcal is CORRECT here and must NOT be flagged.
 *   - 'small_concentrated_portion' — spices/oils/sweeteners/sauces that are
 *                                  legitimately ≤5g. Small grams is expected.
 *   - 'unresolved_estimate'      — the portion or nutrition could not be
 *                                  resolved (missing grams, no match + no
 *                                  macros). These block a silent persist.
 *
 * Deliberately NOT a blanket `grams <= 5` rule: a 3g pinch of salt and a 3g
 * "chicken breast" are both small, but only the first is plausible. We lean on
 * the matched food's per-100g calorie density plus lightweight name-class
 * heuristics to tell them apart.
 */

export type IngredientPlausibility =
  | 'ok'
  | 'genuinely_noncaloric'
  | 'small_concentrated_portion'
  | 'unresolved_estimate';

export interface PlausibilityInput {
  /** Resolved as-eaten grams. `null`/non-finite/≤0 means the portion never resolved. */
  grams: number | null;
  /** Whether Call 2 emitted a usable macro estimate for this ingredient. */
  hasNutrition: boolean;
  /** Matched DB row's per-100g energy, when the ingredient matched a candidate. */
  caloriesPer100g: number | null;
  /**
   * Carbohydrate density in g/100g when derivable, else null.
   * Matched: DB row per-100g carbs. Unmatched: Call 2 absolute carb mid
   * scaled by grams ((mid / grams) * 100). `undefined` (field not provided)
   * skips the carb-staple check entirely — backward-compatible with callers
   * that predate it.
   */
  carbsPer100g?: number | null;
  /** Ingredient name (rawName or canonicalName) for name-class heuristics. */
  name: string;
  /**
   * UNMATCHED-path defense-in-depth (Phase 4/D3 regression guard). Set `true`
   * ONLY for an unmatched / rejected-resolvable ingredient whose Call 2 output
   * OMITTED the caloric macro triple (caloriesKcal/proteinG/carbohydrateG) — the
   * values the server does NOT anchor for unmatched foods. When true, the
   * ingredient is treated as `unresolved_estimate` (routes to clarify) rather
   * than silently persisting a ZERO_TRIPLE row, UNLESS its name is genuinely
   * non-caloric (water/black coffee/plain tea).
   *
   * MUST stay `false`/omitted for matched ingredients: the server anchors their
   * P/C/kcal from the DB row, so an omitted D3 triple is correct there.
   */
  emittedCaloricMacrosMissing?: boolean;
}

/** Foods whose correct calorie contribution is ~zero regardless of volume. */
const NONCALORIC_PATTERNS: RegExp[] = [
  /\bwater\b/i,
  /nướ?c\s*(lọc|suối|khoáng|đun|trắng)/i, // nước lọc/suối/khoáng
  /\bblack\s*coffee\b/i,
  /cà\s*phê\s*đen/i,
  /\b(plain|black|green|herbal)\s*tea\b/i,
  // Anchored to bare trà + noncaloric qualifiers only. Unanchored /trà.../
  // matched "trà sữa"/"trà đào" (very caloric) and reopened the silent-zero
  // hole; qualifiers cover "trà đá không đường"-style names.
  /^(nướ?c\s*)?trà(\s+(đá|xanh|nóng|không\s*đường|unsweetened))*$/i,
  // "ice"/"ice cubes" as a standalone ingredient — NOT "ice cream"/"iced
  // coffee" (word-boundary alone matched those). Anchored like đá below.
  /^ice(\s*cubes?)?$/i,
  /^đá(\s*(viên|lạnh))?$/i,
];

/**
 * Concentrated foods that are routinely used in ≤5g amounts. Matching a name
 * here only *permits* a small portion; it does not by itself resolve grams.
 */
// `\b` word boundaries are only used around ASCII-alphabetic tokens: JS `\b`
// treats Vietnamese-diacritic letters (đ, ơ, ư, …) as non-word characters, so
// `\bđường\b` never matches. Vietnamese tokens therefore use plain (case-
// insensitive) substring matching, which is safe for these distinctive words.
const CONCENTRATED_PATTERNS: RegExp[] = [
  // oils / fats
  /\boils?\b/i,
  /dầu/i,
  /mỡ/i,
  /\bbutter\b/i,
  /bơ/i,
  // sweeteners
  /\bsugar\b/i,
  /đường/i,
  /\bhoney\b/i,
  /mật\s*ong/i,
  // sauces / condiments (small dip/drizzle portions)
  /\bsauce\b/i,
  /nướ?c\s*(mắm|tương|chấm)/i,
  /\bsoy\s*sauce\b/i,
  /\bfish\s*sauce\b/i,
  /tương/i,
  /\bketchup\b/i,
  /\bmayo(nnaise)?\b/i,
  // spices / seasonings
  /\bsalt\b/i,
  /muối/i,
  /\bpepper\b/i,
  /tiêu/i,
  /\bspices?\b/i,
  /gia\s*vị/i,
  /bột\s*(ngọt|nêm|canh)/i, // MSG / seasoning powder
  /\bmsg\b/i,
];

/**
 * Carb-staple names: rice/noodle/bread bases whose correct carb density is
 * high (tens of g/100g). A near-zero carb emission on one of these is the
 * bánh-ướt-chả-bò bug class — the LLM assigned P/F but C≈0 to an unmatched
 * starch and the meal persisted at 0g carbs. Matching here (and NOT the
 * exempt list) makes the carb-staple floor check bite.
 */
const CARB_STAPLE_PATTERNS: RegExp[] = [
  /cơm/i,
  /xôi/i,
  /gạo/i,
  /\brice\b/i,
  /bánh\s*(ướt|cuốn|phở|canh|hỏi|đa|tráng)/i,
  /phở/i,
  /bún/i,
  /miến/i,
  /hủ\s*tiếu/i,
  /hu\s*tieu/i,
  /mì/i,
  /nui/i,
  /\bnoodles?\b/i,
  /\bvermicelli\b/i,
  /\bpasta\b/i,
  /\bspaghetti\b/i,
  /bánh\s*m[ìỳ]/i,
  /\bbread\b/i,
  /\bbaguette\b/i,
];
/**
 * Names that match a CARB_STAPLE_PATTERN by substring but are legitimately
 * low/near-zero carb, so they must NOT trip the floor: broths carry dish
 * names like "nước dùng phở"; konjac/shirataki are real near-zero-carb
 * noodles; mì chính is MSG; mì căn is seitan; giấm gạo / rượu gạo are
 * vinegar / rice wine, not a starch base.
 */
const CARB_STAPLE_EXEMPT_PATTERNS: RegExp[] = [
  /konjac/i,
  /shirataki/i,
  /nướ?c\s*(dùng|lèo)/i,
  /\bbroth\b/i,
  /\bstock\b/i,
  /\bsoup\b/i,
  /mì\s*chính/i,
  /mì\s*căn/i,
  /giấm/i,
  /\bvinegar\b/i,
  /rượu/i,
  /\bwine\b/i,
];
/**
 * Carb-density floor for staples, on the MID bound. Density is portion-
 * invariant, so this is robust across grams. 5 g/100g leaves headroom under
 * thin cháo (~8-13 g/100g — cháo is deliberately NOT in the staple list)
 * while catching C≈0 emissions outright; named low-carb substitutes
 * (konjac/shirataki) are exempted by name, not by threshold.
 */
export const STAPLE_MIN_CARBS_PER_100G = 5;

const SMALL_PORTION_MAX_GRAMS = 5;
/**
 * A resolved portion is "near-zero calories" when its total energy is below
 * this floor. Water/tea/black coffee land here even at 300g because their
 * per-100g density is ~0.
 */
const NEAR_ZERO_KCAL = 1;

function matchesAny(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

function hasResolvedGrams(grams: number | null): grams is number {
  return grams != null && Number.isFinite(grams) && grams > 0;
}

/**
 * Classify a single ingredient result. Pure and side-effect-free so it can be
 * unit-tested in isolation and reused by the completeness gates.
 */
export function classifyIngredientPlausibility(
  input: PlausibilityInput
): IngredientPlausibility {
  const { grams, hasNutrition, caloriesPer100g, name } = input;

  // No portion OR no nutrition → the estimate never resolved. This is the
  // state the silent-zero mechanism used to paper over with grams=1/kcal=0.
  if (!hasResolvedGrams(grams) || !hasNutrition) {
    return 'unresolved_estimate';
  }

  // Genuinely non-caloric drinks: correct at any volume when the matched row
  // is near-zero density, or the name is unambiguously water/plain tea/black
  // coffee. Do NOT flag these. This check precedes the D3-missing-macro guard
  // so a water/coffee/tea name with omitted macros is still non-caloric, not
  // spuriously unresolved.
  const totalKcal =
    caloriesPer100g != null ? (caloriesPer100g * grams) / 100 : null;
  const densityIsNearZero =
    caloriesPer100g != null && caloriesPer100g < NEAR_ZERO_KCAL;
  if (
    matchesAny(name, NONCALORIC_PATTERNS) ||
    (totalKcal != null && densityIsNearZero && totalKcal < NEAR_ZERO_KCAL)
  ) {
    return 'genuinely_noncaloric';
  }

  // Phase 4/D3 regression guard (UNMATCHED path only): the ingredient resolved
  // grams and Call 2 emitted SOMETHING (hasNutrition — fatG is always present),
  // but the caloric macro triple the server does NOT anchor for unmatched foods
  // was omitted. Defense-in-depth: never trust the prompt. A ZERO_TRIPLE row
  // here would be a silent zero-macro persist, so route to clarify instead.
  // Non-caloric names already returned above, so this only bites real foods.
  if (input.emittedCaloricMacrosMissing) {
    return 'unresolved_estimate';
  }

  // Carb-staple floor (bánh-ướt-chả-bò bug class): a rice/noodle/bread base
  // must carry real carbs. `undefined` skips the check (backward-compat). When
  // provided, MATCHED carbs come from the DB row and UNMATCHED carbs are the
  // scaled Call 2 mid; either way a density below the floor is implausible for
  // a staple → route to clarify. Non-null-vs-null semantics: a known low
  // density trips outright; a null density (carb triple omitted for an
  // unmatched staple) only trips when calories are ALSO absent, so a matched
  // staple with a null DB carb but a real energy density still passes.
  if (
    input.carbsPer100g !== undefined &&
    matchesAny(name, CARB_STAPLE_PATTERNS) &&
    !matchesAny(name, CARB_STAPLE_EXEMPT_PATTERNS)
  ) {
    const carbs = input.carbsPer100g;
    if (carbs != null && carbs < STAPLE_MIN_CARBS_PER_100G) {
      return 'unresolved_estimate';
    }
    if (carbs == null && caloriesPer100g == null) {
      return 'unresolved_estimate';
    }
  }

  // Small concentrated portions (spices/oils/sweeteners/sauces): a small gram
  // count is legitimate ONLY when the name is in the concentrated class. A 3g
  // "chicken breast" does NOT get a pass here — it falls through to 'ok' and
  // the anomaly detector / caller can still flag an implausible portion.
  if (
    grams <= SMALL_PORTION_MAX_GRAMS &&
    matchesAny(name, CONCENTRATED_PATTERNS)
  ) {
    return 'small_concentrated_portion';
  }

  return 'ok';
}
