/**
 * The count of a whole dish, held to the text. Call 1 writes "2 burgers" or
 * "2 tô phở" on the dish as `dishCount` and leaves each part describing one
 * unit; a part keeps a count only for an amount typed for that part. After
 * this check that holds for every dish, so a part's count is always its own.
 */
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
  DishCount,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { resolveUnitType } from '@/lib/ai/portion/lexicon/unit-lexicon';
import { normalizeVesselToken } from '@/lib/ai/portion/vessel/geometry';
import { nameKey } from '@/lib/core/text/name-key';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';

/**
 * Spoon, cup, weight and volume words the unit lexicon does not list
 * ("tablespoon", "cups", "ml", "muỗng canh"). An amount in one of these is
 * always typed for its part. Matched on the unit's first word.
 */
const MEASURE =
  /^(?:tbsps?|tsps?|tablespoons?|teaspoons?|spoons?|spoonfuls?|cups?|ml|cl|dl|l|litres?|liters?|oz|ounces?|lbs?|pounds?|g|gr|grams?|kg|kilos?|lạng|muỗng|muong|thìa|thia|scoops?|pumps?|shots?)$/u;

const isOil = (part: DecomposedIngredientV2) =>
  isDiscreteOilIngredient(part.rawName);

/** A unit that measures a part (a spoon, a cup, a gram), never a dish. */
function isMeasure(unitToken: string | undefined): boolean {
  const unit = resolveUnitType(unitToken);
  if (unit === 'volume' || unit === 'mass' || unit === 'container') return true;
  return MEASURE.test(nameKey(unitToken ?? '').split(/\s+/)[0] ?? '');
}

/** Whether a part's unit is the dish's vessel word ("tô" for "2 tô phở"). */
function inVessel(dish: DecomposedDishV2, unitToken: string | undefined) {
  if (!dish.vesselToken || !unitToken) return false;
  return (
    normalizeVesselToken(unitToken) === normalizeVesselToken(dish.vesselToken)
  );
}

const sameUnit = (a: string | undefined, b: string | undefined) =>
  nameKey(a ?? '') === nameKey(b ?? '');

/**
 * The dish count Call 1 copied onto the parts instead of writing `dishCount`:
 * a count every food of the dish carries in the same unit, not a measure
 * ("2 burgers" → bun, patty and oil, each `count: 2, unitToken: "burger"`),
 * or a count in the dish's own vessel word carried by two foods, or by one
 * when no other food has an amount of its own ("1/2 chén bò kho" written only
 * on the beef). A dish where only some foods are counted ("2 quả trứng, 2 quả
 * cà chua và rau") or a shared spoon measure keeps those amounts as typed.
 */
function copiedDishCount(dish: DecomposedDishV2): DishCount | null {
  const foods = dish.ingredients.filter((i) => !isOil(i));
  if (foods.length < 2) return null;
  const [first] = foods;
  if (
    first.count != null &&
    first.unitToken &&
    !isMeasure(first.unitToken) &&
    foods.every(
      (f) => f.count === first.count && sameUnit(f.unitToken, first.unitToken)
    )
  ) {
    return { count: first.count, unitToken: first.unitToken };
  }
  const carrying = foods.filter(
    (f) => f.count != null && f.count > 0 && inVessel(dish, f.unitToken)
  );
  if (carrying.length === 0) return null;
  const counts = new Set(carrying.map((f) => f.count));
  if (counts.size !== 1) return null;
  const ownAmounts = foods.some(
    (f) => !carrying.includes(f) && (f.count != null || f.explicitMass != null)
  );
  if (carrying.length < 2 && ownAmounts) return null;
  const [lead] = carrying;
  return lead.count != null && lead.unitToken
    ? { count: lead.count, unitToken: lead.unitToken }
    : null;
}

/** A part that only repeats the dish's count, in the dish's unit. */
function copiesCount(dish: DecomposedDishV2, part: DecomposedIngredientV2) {
  const count = dish.dishCount;
  if (!count || part.count !== count.count) return false;
  return (
    sameUnit(part.unitToken, count.unitToken) ||
    (inVessel(dish, part.unitToken) && inVessel(dish, count.unitToken))
  );
}

/**
 * The oil of a one-food dish that only copies the food's count ("2 omelettes"
 * → egg and oil, each `count: 2, unitToken: "omelette"`): the food's count is
 * typed, the oil's is not.
 */
function stripOilCopies(dish: DecomposedDishV2): void {
  const foods = dish.ingredients.filter((i) => !isOil(i));
  const [food] = foods;
  if (foods.length !== 1 || food.count == null || isMeasure(food.unitToken))
    return;
  for (const oil of dish.ingredients) {
    if (
      isOil(oil) &&
      oil.count === food.count &&
      sameUnit(oil.unitToken, food.unitToken)
    ) {
      delete oil.count;
      delete oil.unitToken;
    }
  }
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  một: 1,
  two: 2,
  couple: 2,
  pair: 2,
  double: 2,
  hai: 2,
  đôi: 2,
  three: 3,
  ba: 3,
  four: 4,
  bốn: 4,
  tư: 4,
  five: 5,
  năm: 5,
  six: 6,
  sáu: 6,
  seven: 7,
  bảy: 7,
  eight: 8,
  tám: 8,
  nine: 9,
  chín: 9,
  ten: 10,
  mười: 10,
  dozen: 12,
  half: 0.5,
  nửa: 0.5,
  nua: 0.5,
};
const VULGAR: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
};
const WORD = new RegExp(
  `(?<![\\p{L}\\p{M}])(?:${Object.keys(NUMBER_WORDS).join('|')})(?![\\p{L}\\p{M}])`,
  'giu'
);
const DIGITS = /(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?/g;
const AND_A_HALF = /(?<![\p{L}\p{M}])(?:rưỡi|and a half)(?![\p{L}\p{M}])/iu;

/** Every count the text can mean: its digits, fractions and number words. */
function countsIn(text: string): number[] {
  const counts: number[] = [];
  for (const m of text.matchAll(DIGITS)) {
    const n = Number(m[1].replace(',', '.'));
    counts.push(m[2] ? n / Number(m[2]) : n);
  }
  for (const m of text.matchAll(WORD))
    counts.push(NUMBER_WORDS[m[0].toLowerCase()]);
  for (const [sign, n] of Object.entries(VULGAR))
    if (text.includes(sign)) counts.push(n);
  if (AND_A_HALF.test(text)) counts.push(...counts.map((n) => n + 0.5));
  return counts;
}

/** One is any dish's count; anything else must be typed. */
function isTypedCount(count: number, text: string): boolean {
  return count === 1 || countsIn(text).some((n) => Math.abs(n - count) < 0.01);
}

/**
 * Hold each dish's count to the text, in place: lift a count Call 1 copied
 * onto the parts (`copiedDishCount`) to `dishCount`, strip the copies a part
 * still carries, and drop a count the text does not hold. A dish of one food
 * keeps its count on the food, so its single-food priors read it there. A
 * typed zero goes on every part, where the zero check asks about it.
 */
export function holdDishCountsToText(
  decomposition: MealDecompositionV2,
  mealText: string
): void {
  const text = mealText.normalize('NFC');
  for (const dish of decomposition.mealItems) {
    const lifted = dish.dishCount ? null : copiedDishCount(dish);
    if (lifted) {
      dish.dishCount = lifted;
      console.warn(
        `[call1-check] count ${lifted.count} ${lifted.unitToken} lifted to dish "${dish.name}"`
      );
    }
    const count = dish.dishCount;
    if (!count) {
      stripOilCopies(dish);
      continue;
    }
    for (const part of dish.ingredients) {
      if (!copiesCount(dish, part)) continue;
      delete part.count;
      delete part.unitToken;
    }
    if (!isTypedCount(count.count, text)) {
      console.warn(
        `[call1-check] count ${count.count} on dish "${dish.name}" is not in the text`
      );
      dish.dishCount = null;
      continue;
    }
    const foods = dish.ingredients.filter((i) => !isOil(i));
    const zero = count.count === 0;
    const onFood = foods.length === 1 && foods[0].count == null;
    if (!zero && !onFood) continue;
    for (const part of zero ? dish.ingredients : foods) {
      part.count = count.count;
      part.unitToken = count.unitToken;
    }
    dish.dishCount = null;
  }
}
