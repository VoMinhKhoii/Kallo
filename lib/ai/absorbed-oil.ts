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

const NO_OIL_METHOD =
  /kh[oô]ng\s*(?:d[aầ]u|m[ơỡ])|no[- ]?oil|without oil|oil[- ]?free|air[- ]?fr(?:y|ied)|dry[- ]?fr(?:y|ied)|lu[oộ]c|h[aấ]p|steamed?|boiled?|poached?|raw|s[oố]ng/i;
const DEEP_FRY_METHOD =
  /chi[eê]n\s*ng[aậ]p|r[aá]n\s*ng[aậ]p|deep[- ]?fr(?:y|ied)|ng[aậ]p\s*(?:d[aầ]u|m[ơỡ])/i;
const STIR_FRY_METHOD = /x[aà]o|stir[- ]?fr(?:y|ied)|saut[eé](?:ed)?/i;
const PAN_SEAR_METHOD = /[aá]p\s*ch[aả]o|pan[- ]?sear(?:ed)?/i;
const SHALLOW_FRY_METHOD =
  /chi[eê]n|r[aá]n|shallow[- ]?fr(?:y|ied)|pan[- ]?fr(?:y|ied)|fried|fry/i;

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
 * True when this ingredient IS the cooking fat, rather than a food that
 * absorbed some.
 */
export function isDiscreteOilIngredient(name: string | null | undefined) {
  const normalized = name?.normalize('NFC').trim() ?? '';
  return normalized.length > 0 && DISCRETE_OIL_INGREDIENT.test(normalized);
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
  const normalized = method?.normalize('NFC').trim() ?? '';
  if (!normalized || !Number.isFinite(grams) || grams <= 0) return 0;
  // Precedence is by SPECIFICITY, not by list order, because callers
  // concatenate the cooking method with the user's verbatim prep notes and the
  // two routinely disagree — a dish-level `luộc` sitting next to a typed
  // `chiên ngập dầu`.
  //
  //   1. explicit deep-fry wins outright: `luộc chiên ngập dầu` is deep-fried.
  //   2. an explicit negation beats a generic fry verb: `chiên không dầu` is
  //      air-frying and absorbs nothing.
  //   3. generic fry verbs last.
  //
  // Testing no-oil first (the original order) made the guard fail closed to
  // the exact bug it exists to prevent: a stated fry modifier yielding zero
  // oil allowance. Testing fry first would invert the error and charge
  // `chiên không dầu` a full shallow-fry allowance.
  if (DEEP_FRY_METHOD.test(normalized)) {
    return grams * ABSORBED_OIL_RANGES.deepFryWeightRatio.high;
  }
  if (NO_OIL_METHOD.test(normalized)) return 0;
  if (STIR_FRY_METHOD.test(normalized)) {
    return ABSORBED_OIL_RANGES.stirFryG.high;
  }
  if (PAN_SEAR_METHOD.test(normalized)) {
    return ABSORBED_OIL_RANGES.panSearG.high;
  }
  if (SHALLOW_FRY_METHOD.test(normalized)) {
    return ABSORBED_OIL_RANGES.shallowFryG.high;
  }
  return 0;
}

export function renderAbsorbedOilPromptRule(): string {
  const { panSearG, stirFryG, shallowFryG, deepFryWeightRatio } =
    ABSORBED_OIL_RANGES;
  return `pan-sear ${panSearG.low}\u2013${panSearG.high}g, stir-fry ${stirFryG.low}\u2013${stirFryG.high}g, shallow-fry ${shallowFryG.low}\u2013${shallowFryG.high}g, deep-fry ~${deepFryWeightRatio.low * 100}\u2013${deepFryWeightRatio.high * 100}% of food weight`;
}
