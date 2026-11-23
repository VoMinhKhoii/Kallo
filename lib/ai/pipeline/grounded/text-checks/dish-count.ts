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
import {
  normalizeVesselToken,
  resolveVesselFromToken,
  singularWord,
} from '@/lib/ai/portion/vessel/geometry';
import { nameKey } from '@/lib/core/text/name-key';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';
import { typedCountTimes } from './typed-counts';

/**
 * Spoon, cup, weight and volume words the unit lexicon does not list
 * ("tablespoon", "cups", "ml", "muỗng canh"). An amount in one of these is
 * always typed for its part. Matched on the unit's first word.
 */
const MEASURE =
  /^(?:tbsps?|tsps?|tablespoons?|teaspoons?|spoons?|spoonfuls?|cups?|ml|cl|dl|l|litres?|liters?|oz|ounces?|lbs?|pounds?|g|gr|grams?|kg|kilos?|lạng|muỗng|muong|thìa|thia|scoops?|pumps?|shots?)$/u;

const isOil = (part: DecomposedIngredientV2) =>
  isDiscreteOilIngredient(part.rawName);

/** A dish's foods, its cooking oil aside. */
const foodsOf = (dish: DecomposedDishV2) =>
  dish.ingredients.filter((i) => !isOil(i));

/** A unit that measures a part (a spoon, a cup, a gram), never a dish. */
function isMeasure(unitToken: string | undefined): boolean {
  const word = singularWord(nameKey(unitToken ?? ''));
  const unit = resolveUnitType(unitToken) ?? resolveUnitType(word);
  if (unit === 'volume' || unit === 'mass' || unit === 'container') return true;
  return MEASURE.test(word.split(/\s+/)[0] ?? '');
}

/** Whether a part's unit is the dish's vessel word ("tô" for "2 tô phở";
 *  "bowls" for a "bowl"). */
function inVessel(dish: DecomposedDishV2, unitToken: string | undefined) {
  if (!dish.vesselToken || !unitToken) return false;
  return (
    singularWord(normalizeVesselToken(unitToken)) ===
    singularWord(normalizeVesselToken(dish.vesselToken))
  );
}

const sameUnit = (a: string | undefined, b: string | undefined) =>
  singularWord(nameKey(a ?? '')) === singularWord(nameKey(b ?? ''));

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
  const foods = foodsOf(dish);
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

/** Whether a part's unit is the dish count's unit, or both are its vessel. */
function inDishUnit(dish: DecomposedDishV2, part: DecomposedIngredientV2) {
  const count = dish.dishCount;
  if (!count) return false;
  return (
    sameUnit(part.unitToken, count.unitToken) ||
    (inVessel(dish, part.unitToken) && inVessel(dish, count.unitToken))
  );
}

/**
 * A part that only repeats the dish's count in the dish's unit, or says "one"
 * of it when the dish's lone food or two or more of its foods do ("2 tô phở"
 * → `count: 1, unitToken: "tô"` on each part: one bowl's worth, which the
 * dish's count already says). One "1 slice of cheese" beside "2 slices of
 * toast" is the cheese's own amount.
 */
function copiesCount(dish: DecomposedDishV2, part: DecomposedIngredientV2) {
  const count = dish.dishCount;
  if (!count || !inDishUnit(dish, part)) return false;
  if (part.count === count.count) return true;
  if (part.count !== 1) return false;
  const foods = foodsOf(dish);
  const ones = foods.filter((f) => f.count === 1 && inDishUnit(dish, f));
  return foods.length === 1 || ones.length >= 2;
}

/**
 * A one-food dish's count, from its food ("1/2 chén bò kho" logged as one
 * food): kept on the dish too, so a dish rescue that splits the food into its
 * parts still knows how many. Measures ("1 cup of milk") stay the food's.
 */
function loneFoodCount(dish: DecomposedDishV2): DishCount | null {
  const foods = foodsOf(dish);
  const [food] = foods;
  if (foods.length !== 1 || !food.count || !food.unitToken) return null;
  // Part of a bowl or plate with no vessel word on the dish ("1/2 bowl of
  // ramen" written only on the food) is the dish's vessel all the same.
  const partVessel =
    food.count < 1 && resolveVesselFromToken(food.unitToken) !== null;
  return inVessel(dish, food.unitToken) ||
    partVessel ||
    !isMeasure(food.unitToken)
    ? { count: food.count, unitToken: food.unitToken }
    : null;
}

/**
 * The oil that only copies the count every food of its dish carries ("2
 * omelettes" → egg and oil, each `count: 2, unitToken: "omelette"`): the
 * foods' count is theirs or the dish's, the oil's is not. A spoon or cup of
 * oil is its own amount.
 */
function stripOilCopies(dish: DecomposedDishV2): void {
  const foods = foodsOf(dish);
  for (const oil of dish.ingredients) {
    if (
      isOil(oil) &&
      oil.count != null &&
      !isMeasure(oil.unitToken) &&
      foods.length > 0 &&
      foods.every(
        (f) => f.count === oil.count && sameUnit(f.unitToken, oil.unitToken)
      )
    ) {
      delete oil.count;
      delete oil.unitToken;
    }
  }
}

/**
 * Whether the server may take a count from the parts to the dish: the text
 * states it once. One stated twice ("2 quả trứng, 2 quả cà chua", "2 slices
 * of toast with 2 slices of cheese") is each food's own.
 */
const liftable = (count: DishCount, text: string) =>
  typedCountTimes(count.count, text) === 1 ||
  (count.count === 1 && typedCountTimes(1, text) <= 1);

/**
 * Hold each dish's count to the text, in place: lift a count Call 1 copied
 * onto the parts (`copiedDishCount`) to `dishCount` when the text states it
 * once, and strip the copies a part still carries; when unsure, the parts
 * stay as Call 1 wrote them. Call 1's own `dishCount` is kept even when the
 * text reader cannot find its number (counts are written in more ways than
 * it reads), and logged. A dish of one food also carries its count on the
 * food, so its single-food priors read it there; the dish keeps it too, so a
 * dish rescue that splits the food still knows how many. A typed zero goes
 * on every part instead, where the zero check asks about it.
 */
export function holdDishCountsToText(
  decomposition: MealDecompositionV2,
  mealText: string
): void {
  const text = mealText.normalize('NFC');
  for (const dish of decomposition.mealItems) {
    const lifted = dish.dishCount
      ? null
      : (copiedDishCount(dish) ?? loneFoodCount(dish));
    const count = dish.dishCount ?? lifted;
    if (!count || (lifted && !liftable(lifted, text))) {
      stripOilCopies(dish);
      continue;
    }
    if (lifted && foodsOf(dish).length > 1)
      console.warn(
        `[call1-check] count ${count.count} ${count.unitToken} lifted to dish "${dish.name}"`
      );
    if (
      !lifted &&
      count.count !== 1 &&
      typedCountTimes(count.count, text) === 0
    )
      console.warn(
        `[call1-check] count ${count.count} on dish "${dish.name}" is not read in the text; kept`
      );
    dish.dishCount = count;
    // Judge every part before stripping any: whether a 1 is a copy depends
    // on how many parts carry it.
    for (const part of dish.ingredients.filter((p) => copiesCount(dish, p))) {
      delete part.count;
      delete part.unitToken;
    }
    if (count.count === 0) spreadZero(dish, count);
    else mirrorOntoLoneFood(dish, count);
  }
}

/** A typed zero ("0 burgers") on every part, where the zero check asks. */
function spreadZero(dish: DecomposedDishV2, count: DishCount): void {
  for (const part of dish.ingredients) {
    part.count = 0;
    part.unitToken = count.unitToken;
  }
  dish.dishCount = null;
}

/** A dish of one food carries its count on the food too, for its priors. */
function mirrorOntoLoneFood(dish: DecomposedDishV2, count: DishCount): void {
  const foods = foodsOf(dish);
  if (foods.length !== 1 || foods[0].count != null) return;
  foods[0].count = count.count;
  foods[0].unitToken = count.unitToken;
}
