export interface AbsorbedOilRange {
  low: number;
  high: number;
}

/**
 * Shared absorbed-oil assumptions for Call 2 and the server-side fat guard.
 * Fixed ranges are grams per serving; deep-fry values are fractions of the
 * ingredient's food weight.
 */
export const ABSORBED_OIL_RANGES = {
  panSearG: { low: 3, high: 7 },
  stirFryG: { low: 5, high: 10 },
  shallowFryG: { low: 8, high: 15 },
  deepFryWeightRatio: { low: 0.1, high: 0.18 },
} as const satisfies Record<string, AbsorbedOilRange>;

/**
 * A statement that no fat was used. These OVERRIDE a generic fry verb, because
 * they describe the frying itself: `chiên không dầu` is air-frying.
 */
/**
 * A method pattern that starts and ends at a letter edge (`\b` is ASCII-only),
 * so a fry verb inside another word ("ranch", "orange", "bánh tráng") is not
 * a fry verb.
 */
const wordEdged = (body: string) =>
  new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, 'iu');
const FRY = 'fr(?:y|ying|ied)';
/** An appliance named after the method ("air fryer", "deep-fryer"). */
const FRY_OR_FRYER = 'fr(?:y|ying|ied|yer)';

const OIL_NEGATION = wordEdged(
  `kh[oô]ng\\s+(?:(?:c[oó]|d[uù]ng|th[eê]m|cho)\\s+)?(?:d[aầ]u|m[ơỡ])|no[- ]?(?:added )?oil|without (?:any |added )?oil|oil[- ]?free|air[- ]?${FRY_OR_FRYER}|dry[- ]?${FRY}`
);

// `luộc`, `hấp`, `steamed`, `boiled`, `poached`, `raw` and `sống` are NOT listed
// as negations. They use no fat, but they do not negate one, so they must lose
// to a fry verb rather than beat it: `luộc rồi chiên` is boiled AND THEN fried,
// and the frying still puts oil in the food. They need no pattern of their own —
// absent any fry verb they fall through to the function's default of zero.
const DEEP_FRY_METHOD = wordEdged(
  `chi[eê]n\\s*ng[aậ]p|r[aá]n\\s*ng[aậ]p|deep[- ]?${FRY_OR_FRYER}|ng[aậ]p\\s*(?:d[aầ]u|m[ơỡ])`
);
const STIR_FRY_METHOD = wordEdged(`x[aà]o|stir[- ]?${FRY}|saut[eé](?:ed|ing)?`);
const PAN_SEAR_METHOD = wordEdged('[aá]p\\s*ch[aả]o|pan[- ]?sear(?:ed|ing)?');
const SHALLOW_FRY_METHOD = wordEdged(
  `chi[eê]n|r[aá]n|shallow[- ]?${FRY}|pan[- ]?${FRY}|${FRY}`
);

/** True when the text says no fat was used ("chiên không dầu", "air-fried"). */
export function saysNoOil(text: string | null | undefined): boolean {
  return OIL_NEGATION.test(withoutCondiments(text?.normalize('NFC') ?? ''));
}

/**
 * Soy sauce, oyster sauce and vinaigrette carry "dầu" but no cooking fat, so a
 * note that leaves them out ("không dùng dầu hào") says nothing about oil. A
 * placeholder word keeps "không dầu hào thêm dầu" from reading "không thêm dầu".
 */
function withoutCondiments(text: string): string {
  return text.replace(new RegExp(OIL_LIKE_CONDIMENT.source, 'giu'), ' sauce ');
}

/**
 * Cooking fats that Call 1 emits as their OWN ingredient row, so their grams,
 * fat and micronutrients (vitamin E in particular) land in the meal totals
 * instead of disappearing into a neighbouring food's fat number.
 *
 * Deliberately excludes bare `bơ`: in Vietnamese it is both "butter" and
 * "avocado" (`quả bơ`, `trái bơ`), and a false positive here suppresses the
 * absorbed-oil allowance for every other ingredient in the dish. English
 * `butter` is unambiguous and is matched.
 */
const DISCRETE_OIL_INGREDIENT =
  /d[aầ]u\s*[aă]n|d[aầ]u\b|m[ơỡ]\s*(?:heo|n[uư][ơớ]c|l[oợ]n)|\boil\b|\bbutter\b|\bghee\b|\blard\b|\bmargarine\b|\bshortening\b|\btallow\b/i;

/**
 * Condiments whose names contain `dầu` but which are NOT the fat a neighbouring
 * food was fried in: `dầu giấm` is vinaigrette, `dầu hào` is oyster sauce.
 *
 * Without this, a plate of fried fish served with a vinaigrette salad reads as
 * "the frying oil is already its own row" and the fish loses its absorbed-oil
 * allowance — under-reporting the fat this module exists to preserve.
 * `salad dầu giấm` appears in our own adjustment eval set, so this is not
 * hypothetical. `xì dầu` is soy sauce.
 */
const OIL_LIKE_CONDIMENT = /d[aầ]u\s*(?:gi[aấ]m|h[aà]o)|x[iì]\s*d[aầ]u/i;

/**
 * Foods whose names carry a fat word but are not a cooking fat: nut and fruit
 * butters, dishes named for butter, foods packed in oil. A part that matched a
 * row is judged by that row's composition instead (`isCookingFatPart`); this
 * only keeps an unmatched one from being read, and dropped, as frying fat.
 */
const FOOD_NAMED_FOR_A_FAT =
  /\b(?:peanut|almond|cashew|nut|seed|sunflower|cookie|apple|cocoa|cacao|shea)\s+butter\b|\bbutter\s+(?:naan|beans?|lettuce|chicken|cake|cookies?|croissants?|bread|squash|tarts?)\b|\bbuttermilk\b|\b(?:in|packed\s+in)\s+(?:olive\s+|sunflower\s+|vegetable\s+)?oil\b|b[ơo]\s+[dđ][aậ]u\s+ph[ộo]ng|ng[aâ]m\s+d[aầ]u/i;

/**
 * The names the decomposition prompt tells Call 1 to use for a cooking-fat
 * row. The prompt renders this list rather than spelling one of its own, so it
 * cannot offer a name this module fails to recognise — which is how bare `bơ`
 * and `mỡ` once reached the prompt and let a butter row's siblings claim
 * absorbed oil on top of it.
 */
export const COOKING_FAT_ROW_NAMES = [
  'dầu ăn',
  'oil',
  'butter',
  'mỡ heo',
] as const;

/**
 * True when this ingredient IS the cooking fat, rather than a food that
 * absorbed some.
 */
export function isDiscreteOilIngredient(name: string | null | undefined) {
  const normalized = name?.normalize('NFC').trim() ?? '';
  if (normalized.length === 0) return false;
  if (OIL_LIKE_CONDIMENT.test(normalized)) return false;
  if (FOOD_NAMED_FOR_A_FAT.test(normalized)) return false;
  return DISCRETE_OIL_INGREDIENT.test(normalized);
}

/**
 * True when a meal part is a cooking fat. A matched part's row composition
 * decides (`pureFatKind`, from fat >= 80 g and little else per 100 g), so
 * "peanut butter", "butter beans" and "tuna in oil" are not fats; the name
 * only decides for a part that matched no row.
 */
export function isCookingFatPart(
  name: string | null | undefined,
  matchedBase: { pureFatKind?: string | null } | undefined
): boolean {
  if (matchedBase) return matchedBase.pureFatKind != null;
  return isDiscreteOilIngredient(name);
}

/**
 * True when a meal item already carries the frying fat as its own row. Its
 * sibling foods must then NOT also be granted an absorbed-oil allowance, or
 * the same oil is counted twice — observed as a plate of deep-fried potatoes
 * reporting 21.8g of absorbed fat next to a discrete 25g `Oil` row.
 */
export function mealItemHasDiscreteOil(
  ingredientNames: ReadonlyArray<string | null | undefined>
) {
  return ingredientNames.some(isDiscreteOilIngredient);
}

/**
 * Return the maximum plausible absorbed oil for a cooking method. The guard
 * uses the upper end because its job is to reject implausible estimates, not
 * to replace Call 2's estimate with a server-selected midpoint.
 */
export function absorbedOil(method: string | null | undefined, grams: number) {
  const normalized = withoutCondiments(method?.normalize('NFC') ?? '').trim();
  if (!normalized || !Number.isFinite(grams) || grams <= 0) return 0;
  // Precedence is by SPECIFICITY, not by list order, because callers
  // concatenate the cooking method with the user's verbatim prep notes and the
  // two routinely disagree — a dish-level `luộc` sitting next to a typed
  // `chiên ngập dầu`.
  //
  //   1. explicit deep-fry wins outright: `luộc chiên ngập dầu` is deep-fried.
  //   2. an explicit NEGATION beats a generic fry verb: `chiên không dầu` is
  //      air-frying and absorbs nothing.
  //   3. generic fry verbs.
  //   4. a non-fry method only when no fry verb appeared at all — `luộc rồi
  //      chiên` is boiled and then fried, so the frying still counts.
  //
  // Testing no-oil first (the original order) made the guard fail closed to
  // the exact bug it exists to prevent: a stated fry modifier yielding zero
  // oil allowance. Testing fry first would invert the error and charge
  // `chiên không dầu` a full shallow-fry allowance.
  if (DEEP_FRY_METHOD.test(normalized)) {
    return grams * ABSORBED_OIL_RANGES.deepFryWeightRatio.high;
  }
  if (OIL_NEGATION.test(normalized)) return 0;
  if (STIR_FRY_METHOD.test(normalized)) {
    return ABSORBED_OIL_RANGES.stirFryG.high;
  }
  if (PAN_SEAR_METHOD.test(normalized)) {
    return ABSORBED_OIL_RANGES.panSearG.high;
  }
  if (SHALLOW_FRY_METHOD.test(normalized)) {
    return ABSORBED_OIL_RANGES.shallowFryG.high;
  }
  // Everything else — `luộc`, `hấp`, `steamed`, `raw` and any unrecognised
  // method — absorbs nothing.
  return 0;
}

export function renderAbsorbedOilPromptRule(): string {
  const { panSearG, stirFryG, shallowFryG, deepFryWeightRatio } =
    ABSORBED_OIL_RANGES;
  return `pan-sear ${panSearG.low}\u2013${panSearG.high}g, stir-fry ${stirFryG.low}\u2013${stirFryG.high}g, shallow-fry ${shallowFryG.low}\u2013${shallowFryG.high}g, deep-fry ~${deepFryWeightRatio.low * 100}\u2013${deepFryWeightRatio.high * 100}% of food weight`;
}

/** An English row name or card cooking method that says the food was fried in fat. */
const FRIED_ROW = /\bfried\b/i;
/** Fried without added fat, or a name where "fried" says nothing about fat. */
const NOT_FAT_FRIED = /\b(?:pan|stir|air|dry)[- ]?fried\b|not breaded/i;
/**
 * Below this much fat per 100 g a row labelled fried does not carry its frying
 * oil in its values (a shallow-fried lean fish at 0.7 g), so the oil row stays.
 */
const FRIED_ROW_MIN_FAT_G = 3;

/**
 * True when a matched DB row already represents a fat-fried food, so its
 * per-100g fat already includes the frying oil ("Egg, whole, cooked, fried",
 * or a card whose `cooking_method` is "deep-fried").
 *
 * Reads only the source's English row name and the curated card's cooking
 * method, never the Vietnamese display name: machine-translated names carry
 * "rán"/"chiên" where the food is not fried (every USDA "broilers or fryers"
 * chicken row is "gà rán", "Bột chiên giòn" is a dry batter mix). A row whose
 * English name is empty (NIN) counts as fried only through its card's cooking
 * method, which is curated data.
 */
export function isAlreadyFriedRow(
  rowNameEn: string | null | undefined,
  rowCookingMethod?: string | null,
  /** The row's fat per 100 g, when known: a "fried" row this lean holds no frying oil. */
  rowFatPer100g?: number | null
): boolean {
  if (rowFatPer100g != null && rowFatPer100g < FRIED_ROW_MIN_FAT_G)
    return false;
  const name = rowNameEn?.normalize('NFC').trim() ?? '';
  if (NOT_FAT_FRIED.test(name)) return false;
  if (FRIED_ROW.test(name)) return true;
  const method = rowCookingMethod?.normalize('NFC').trim() ?? '';
  return FRIED_ROW.test(method) && !NOT_FAT_FRIED.test(method);
}

/** A Vietnamese word that starts or ends at a letter edge (`\b` is ASCII-only). */
const vi = (body: string) => `(?<!\\p{L})(?:${body})(?!\\p{L})`;
/** Cooking fats in Vietnamese, accented only: unaccented "dau"/"bo"/"mo" are also đậu, bò, mò. */
const VI_FAT = 'dầu|mỡ|bơ';

/**
 * A note that cuts the fat on the food itself ("ít dầu", "less oil", "bỏ da",
 * "low-fat"): never a request for more.
 */
const REDUCED_FAT = new RegExp(
  [
    vi(`ít\\s+(?:${VI_FAT}|béo)`),
    vi('bỏ\\s+(?:da|mỡ)'),
    String.raw`\b(?:oil|fat)[- ]?free\b`,
    String.raw`\blow[- ]?fat\b`,
    String.raw`\b(?:less|light)\s+(?:oil|butter|fat)\b`,
  ].join('|'),
  'iu'
);
/** A word that negates what comes shortly after it. */
const NEGATION_WORD = new RegExp(
  vi("không|chẳng|ko|đừng|no|not|without|never|\\p{L}+n['’]t"),
  'iu'
);
/**
 * How many words back a negation still governs a fat phrase: "không thêm
 * dầu", "not too oily", "do not add extra oil". Free text in two languages has
 * no clean parse, so an ambiguous note ("không đường phết bơ") reads as no
 * request. That keeps the 1.25x cap; Call 2 still reads the note itself.
 */
const NEGATION_REACH_WORDS = 3;
/** Clause breaks: a negation does not carry past them. */
const CLAUSE_BREAK = /[,;.\n]|(?<!\p{L})(?:but|nhưng|còn)(?!\p{L})/iu;

const EXTRA_FAT_NOTE = new RegExp(
  [
    String.raw`\b(?:extra|more|heavy|added|double|lots\s+of|with|doused\s+in|soaked\s+in|drizzled\s+with|cooked\s+in|brushed\s+with|basted\s+with|topped\s+with|loaded\s+with)\s+(?:(?:olive|sesame|coconut|vegetable|bacon)\s+)?(?:oil|butter|ghee|lard|fat|grease|margarine)\b`,
    String.raw`\b(?:buttered|greasy|oily|extra\s+fatty)\b`,
    vi(
      `(?:thêm|nhiều|đẫm|ngập|phết|trét|quết|rưới|chan|có|kèm)\\s+(?:${VI_FAT})`
    ),
    vi(`(?:${VI_FAT})\\s+(?:nhiều|thêm)`),
  ].join('|'),
  'giu'
);

/**
 * True when any user-typed prep note explicitly asks for extra fat (e.g.
 * "extra oil", "extra butter", "with butter", "nhiều mỡ", "phết bơ",
 * "thêm dầu"). Checked per note so a reduction note ("bỏ da") alongside an
 * addition note ("extra butter") still unlocks the wider fat band.
 */
export function prepNotesAskForExtraFat(
  prepNotes: readonly string[] | undefined
): boolean {
  if (!prepNotes || prepNotes.length === 0) return false;
  return prepNotes.some((raw) =>
    raw
      .normalize('NFC')
      .replace(new RegExp(OIL_LIKE_CONDIMENT.source, 'giu'), ' sauce ')
      .split(CLAUSE_BREAK)
      .some((clause) => {
        if (REDUCED_FAT.test(clause)) return false;
        // Any fat phrase in the clause that no nearby negation governs.
        return [...clause.matchAll(EXTRA_FAT_NOTE)].some((ask) => {
          const before = clause
            .slice(0, ask.index)
            .split(/\s+/)
            .filter(Boolean)
            .slice(-NEGATION_REACH_WORDS)
            .join(' ');
          // "non-greasy": "non" negates only as a prefix on the fat word.
          if (/(?<!\p{L})non-\s*$/iu.test(clause.slice(0, ask.index)))
            return false;
          return !NEGATION_WORD.test(before);
        });
      })
  );
}
