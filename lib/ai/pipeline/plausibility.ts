/**
 * Per-ingredient plausibility classification for the v2 grounded pipeline.
 *
 * Phase 1 replaced the silent-zero mechanism (grams=1, kcal=0 rows) with an
 * explicit classification. This is now a TELEMETRY signal only — there is no
 * clarify round-trip. An `unresolved_estimate` ingredient still ships on its
 * best estimate and the user corrects the portion in the UI; only the bridge's
 * no-data carve-out (no portion / no macro anchor) withholds a row.
 *
 * The four classes:
 *   - 'ok'                       — resolved with a sensible portion + nutrition.
 *   - 'genuinely_noncaloric'     — water, black coffee, plain tea. Near-zero
 *                                  kcal is CORRECT here and must NOT be flagged.
 *   - 'small_concentrated_portion' — spices/oils/sweeteners/sauces that are
 *                                  legitimately ≤5g. Small grams is expected.
 *   - 'unresolved_estimate'      — the portion or nutrition could not be
 *                                  resolved (missing grams, no match + no
 *                                  macros). Flagged for telemetry, not blocked.
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
}

/** Foods whose correct calorie contribution is ~zero regardless of volume. */
// FULLY anchored (^…$), not \b-bounded. A loose head-noun match let any
// caloric variant inherit the zero: "coconut water", "sweetened green tea",
// "peach green tea", "black coffee 3-in-1". A modifier blocklist alone can
// never be complete, so the allowlist of qualifiers is the real guard and
// `hasCaloricModifier` is defense-in-depth behind it.
const NONCALORIC_PATTERNS: RegExp[] = [
  /^(plain|mineral|sparkling|still|filtered|tap|iced?|warm|hot|cold)?\s*water$/i,
  /^nướ?c\s*(lọc|suối|khoáng|đun|trắng)(\s*(sôi|nguội|ấm|để\s*nguội))*$/i,
  /^black\s*coffee$/i,
  /^cà\s*phê\s*đen(\s*(đá|nóng))*$/i,
  /^((plain|black|green|herbal|unsweetened)\s+)*tea$/i,
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
 * Explicit sugar-free markers. Stripped BEFORE the caloric-modifier test so
 * "trà đá không đường" is not disqualified by the bare word "đường".
 */
const SUGAR_FREE = /(không\s*đường|unsweetened|sugar[-\s]?free|no\s+sugar)/gi;

/**
 * Modifiers that make an otherwise-noncaloric drink caloric. The NONCALORIC
 * head nouns (water/coffee/tea/nước) are matched loosely, so without this a
 * caloric variant inherits the zero: `/\bwater\b/` matched "coconut water",
 * `/\bblack\s*coffee\b/` matched "black coffee with sugar", and
 * `/\bgreen\s*tea\b/` matched "green tea latte" — each a silent zero on a real
 * drink. Same failure mode the anchored `trà` pattern above already guards.
 */
const CALORIC_MODIFIER =
  /(sữa|đường|mật\s*ong|kem|sy-?rô|syrup|sugar|milk|honey|cream|latte|mocha|boba|trân\s*châu|dừa|coconut|nướ?c\s*ép|juice)/i;

/** True when a noncaloric-looking name carries a caloric modifier. */
function hasCaloricModifier(name: string): boolean {
  return CALORIC_MODIFIER.test(name.replace(SUGAR_FREE, ' '));
}

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
 * Vietnamese-safe word boundary. JS `\b` treats diacritic letters (đ, ế, ơ) as
 * non-word characters, so `\bmiến\b` never matches — which is why these lists
 * used bare substring matching. But `miến` (glass noodle) is a strict PREFIX of
 * `miếng` (the "piece/slice" classifier), so "miếng vịt" tripped the carb-staple
 * floor and blanked the whole meal. Match only at real word edges instead; the
 * lookarounds subsume `\b` for the ASCII tokens too.
 */
function viWord(token: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])(?:${token})(?![\\p{L}\\p{M}\\p{N}])`,
    'iu'
  );
}

/**
 * Carb-staple names: rice/noodle/bread bases whose correct carb density is
 * high (tens of g/100g). A near-zero carb emission on one of these is the
 * bánh-ướt-chả-bò bug class — the LLM assigned P/F but C≈0 to an unmatched
 * starch and the meal persisted at 0g carbs. Matching here (and NOT the
 * exempt list) makes the carb-staple floor check bite.
 */
const CARB_STAPLE_PATTERNS: RegExp[] = [
  viWord('cơm'),
  viWord('xôi'),
  viWord('gạo'),
  viWord('rice'),
  viWord('bánh\\s*(?:ướt|cuốn|phở|canh|hỏi|đa|tráng)'),
  viWord('phở'),
  viWord('bún'),
  viWord('miến'),
  viWord('hủ\\s*tiếu'),
  viWord('hu\\s*tieu'),
  viWord('mì'),
  viWord('nui'),
  viWord('noodles?'),
  viWord('vermicelli'),
  viWord('pasta'),
  viWord('spaghetti'),
  viWord('bánh\\s*m[ìỳ]'),
  viWord('bread'),
  viWord('baguette'),
];
/**
 * Names that match a CARB_STAPLE_PATTERN by substring but are legitimately
 * low/near-zero carb, so they must NOT trip the floor: broths carry dish
 * names like "nước dùng phở"; konjac/shirataki are real near-zero-carb
 * noodles; mì chính is MSG; mì căn is seitan; giấm gạo / rượu gạo are
 * vinegar / rice wine, not a starch base.
 */
// Boundary-anchored like the staple list itself: bare substrings let unrelated
// words suppress a real staple failure ("stockfish noodles" was exempted by
// `stock`, "bánh mì wineberry" by `wine`). `m[ìi]` accepts the mixed-diacritic
// spellings ("mì chinh"/"mi chính") the model emits, which a bare `mì` missed
// and which then produced false staple telemetry.
const CARB_STAPLE_EXEMPT_PATTERNS: RegExp[] = [
  viWord('konjac'),
  viWord('shirataki'),
  viWord('nướ?c\\s*(?:dùng|lèo)'),
  viWord('broth'),
  viWord('stock'),
  viWord('soup'),
  viWord('m[ìi]\\s*ch[íi]nh'),
  viWord('m[ìi]\\s*c[ăa]n'),
  viWord('giấm'),
  viWord('vinegar'),
  viWord('rượu'),
  viWord('wine'),
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
  // NFC so a decomposed name from the model still matches the composed literals
  // in the pattern lists (same convention as matching/aliases.ts).
  const normalized = name.normalize('NFC');
  return patterns.some((p) => p.test(normalized));
}

/**
 * Is this name a rice/noodle/bread base that MUST carry real carbs?
 *
 * The staple and exempt lists are the single source of truth for "is this a
 * starch", so the bridge's no-macro-anchor carve-out asks THIS rather than
 * keeping a second copy that could drift out of sync with the exemptions
 * (`mì chính` = MSG, `mì căn` = seitan, konjac, broths named after dishes).
 */
export function isCarbStapleName(name: string): boolean {
  return (
    matchesAny(name, CARB_STAPLE_PATTERNS) &&
    !matchesAny(name, CARB_STAPLE_EXEMPT_PATTERNS)
  );
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
  // A caloric modifier disqualifies the name-based match, but NOT the measured
  // one: a DB row at <1 kcal/100g is evidence, not a heuristic.
  if (
    (matchesAny(name, NONCALORIC_PATTERNS) && !hasCaloricModifier(name)) ||
    (totalKcal != null && densityIsNearZero && totalKcal < NEAR_ZERO_KCAL)
  ) {
    return 'genuinely_noncaloric';
  }

  // Carb-staple floor (bánh-ướt-chả-bò bug class): a rice/noodle/bread base
  // must carry real carbs. `undefined` skips the check (backward-compat). When
  // provided, MATCHED carbs come from the DB row and UNMATCHED carbs are the
  // scaled Call 2 mid; either way a density below the floor is implausible for
  // a staple → flag it. Non-null-vs-null semantics: a known low
  // density trips outright; a null density (carb triple omitted for an
  // unmatched staple) only trips when calories are ALSO absent, so a matched
  // staple with a null DB carb but a real energy density still passes.
  if (input.carbsPer100g !== undefined && isCarbStapleName(name)) {
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
