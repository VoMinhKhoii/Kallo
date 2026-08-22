/**
 * Name-class lexicons: what an ingredient's NAME alone proves about it.
 *
 * Three classes drive plausibility, and each is a list of Vietnamese/English
 * patterns rather than a threshold, because the thresholds are what fail:
 *   - non-caloric  — water, black coffee, plain tea. Zero kcal is CORRECT.
 *   - concentrated — spices/oils/sweeteners/sauces. ≤5 g is EXPECTED.
 *   - carb staple  — rice/noodle/bread bases. A near-zero carb is a BUG.
 *
 * Data, not logic: every export here is a name test. The decision that reads
 * them is `plausibility.ts`.
 */

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

function matchesAny(name: string, patterns: RegExp[]): boolean {
  // NFC so a decomposed name from the model still matches the composed literals
  // in the pattern lists (same convention as matching/aliases.ts).
  const normalized = name.normalize('NFC');
  return patterns.some((p) => p.test(normalized));
}

/** True when a noncaloric-looking name carries a caloric modifier. */
function hasCaloricModifier(name: string): boolean {
  return CALORIC_MODIFIER.test(name.replace(SUGAR_FREE, ' '));
}

/**
 * Is this name unambiguously water / plain tea / black coffee — a drink whose
 * correct energy is ~zero at any volume? A caloric modifier ("trà sữa",
 * "coconut water") disqualifies it.
 */
export function isNoncaloricName(name: string): boolean {
  return matchesAny(name, NONCALORIC_PATTERNS) && !hasCaloricModifier(name);
}

/** Is this a spice/oil/sweetener/sauce, i.e. legitimately used in ≤5 g? */
export function isConcentratedName(name: string): boolean {
  return matchesAny(name, CONCENTRATED_PATTERNS);
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
