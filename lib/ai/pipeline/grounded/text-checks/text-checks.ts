/**
 * Checks on Call 1's answer against the text the user typed. Call 1 only
 * extracts: a weight or a calorie figure it reports must be one the user
 * wrote, and a display name must be in the answer's language. Each check removes or moves the one field
 * that fails it, so the rest of the answer is used as written. A removed
 * weight means "no weight typed", the same reading the Claude repair gives a
 * weight of 0 (`provider/claude/schema.ts`).
 */
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { nameKey } from '@/lib/core/text/name-key';
import {
  foodAfter,
  foodBefore,
  isTypedAmount,
  isTypedWeight,
  near,
  type TypedKcal,
  type TypedWeight,
  typedKcals,
  typedWeights,
  wordsOf,
} from './typed-amounts';

/**
 * The one food of the dish a phrase from the text names, when it names that
 * food and not the dish: the food's exact name, or else the food whose words
 * are all in the phrase and cover more of it than the dish's own name does
 * ("chicken breast" is the korma's "Chicken", not "Homemade chicken korma";
 * "mì xào bò" is the dish, not its noodles).
 */
function foodNamedBy(
  phrase: string,
  dish: DecomposedDishV2
): DecomposedIngredientV2 | null {
  if (!phrase || phrase === nameKey(dish.name)) return null;
  const exact = dish.ingredients.filter((i) => nameKey(i.rawName) === phrase);
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  const said = new Set(wordsOf(phrase));
  const cover = (name: string) =>
    new Set(wordsOf(name).filter((w) => said.has(w))).size;
  const inside = (name: string) => {
    const words = wordsOf(name);
    return words.length > 0 && words.every((w) => said.has(w));
  };
  const foods = dish.ingredients.filter((i) => inside(i.rawName));
  const best = Math.max(0, ...foods.map((i) => cover(i.rawName)));
  const named = foods.filter((i) => cover(i.rawName) === best);
  const dishCover = cover(dish.name);
  const beatsDish =
    best > dishCover || (best === dishCover && !inside(dish.name));
  return named.length === 1 && beatsDish ? named[0] : null;
}

/**
 * A dish weight that is one food's weight goes back to that food. Call 1
 * sometimes merges a weighed food and its sides into one dish and writes the
 * food's weight on the dish ("A 300g ribeye steak with fries and peppercorn
 * sauce" as one 300 g dish; a korma's "150g chicken breast" as a 150 g
 * korma), which shrinks that food to make room for the rest. Moved only when
 * the text names exactly one of the dish's foods beside the weight, that food
 * has no weight of its own, and the dish is more than that food.
 */
function moveOneFoodWeight(
  dish: DecomposedDishV2,
  text: string,
  typed: TypedWeight[]
): void {
  const served = dish.servedMassG;
  if (!served || dish.ingredients.length < 2) return;
  for (const weight of typed.filter((t) => near(t.grams, served))) {
    for (const phrase of [foodAfter(text, weight), foodBefore(text, weight)]) {
      const food = foodNamedBy(phrase, dish);
      if (!food || food.explicitMass) continue;
      food.explicitMass = { grams: served, basis: 'unknown' };
      delete dish.servedMassG;
      console.warn(
        `[call1-check] dish weight ${served}g on "${dish.name}" moved to "${food.rawName}"`
      );
      return;
    }
  }
}

/**
 * Hold Call 1's weights to the text, in place:
 * - a food or dish weight the user did not type (nor a share, multiple or sum
 *   of typed weights) is removed;
 * - a dish weight that only repeats its weighed parts (one part's weight, or
 *   their sum) is removed: the user weighed the parts, not the dish, and the
 *   dish weight would squeeze every unweighed part to fit;
 * - a dish weight typed on one of the dish's foods goes to that food.
 * A text with a weight written in words is left as Call 1 answered it.
 */
export function holdWeightsToText(
  decomposition: MealDecompositionV2,
  mealText: string
): void {
  const typed = typedWeights(mealText);
  if (!typed) return;
  const text = mealText.normalize('NFC');
  for (const dish of decomposition.mealItems) {
    for (const ing of dish.ingredients) {
      if (
        ing.explicitMass &&
        !isTypedWeight(ing.explicitMass.grams, typed, text)
      ) {
        console.warn(
          `[call1-check] untyped weight ${ing.explicitMass.grams}g removed from "${ing.rawName}"`
        );
        delete ing.explicitMass;
      }
    }
    if (!dish.servedMassG) continue;
    const served = dish.servedMassG;
    const parts = dish.ingredients.flatMap((i) => i.explicitMass?.grams ?? []);
    const repeatsParts =
      dish.ingredients.length > 1 &&
      parts.length > 0 &&
      (parts.some((p) => near(p, served)) ||
        near(
          parts.reduce((s, p) => s + p, 0),
          served
        ));
    if (!isTypedWeight(served, typed, text) || repeatsParts) {
      console.warn(
        `[call1-check] ${repeatsParts ? 'part' : 'untyped'} weight ${served}g removed from dish "${dish.name}"`
      );
      delete dish.servedMassG;
      continue;
    }
    moveOneFoodWeight(dish, text, typed);
  }
}

/** Words that make a typed figure a share or a per-unit amount, which only Call 1 reads. */
const SHARE_OR_EACH =
  /(?<!\p{L})(?:nửa|half|chia|share[ds]?|split|phần|third|quarter|mỗi|each|per)(?!\p{L})|[½⅓¼%]|\d\s*\/\s*\d/iu;

/** A figure stated per unit: "110kcal mỗi hộp", "80 kcal each", "90 kcal/gói". */
const PER_UNIT =
  /(?<!\p{L})(?:mỗi|each|per|apiece)(?!\p{L})|(?:kcals?|calo|calories?|cals?)\s*\/\s*\p{L}/iu;

/** The dish a food phrase from the text names: most of the shorter name's words are shared. */
function namesDish(phrase: string, dish: DecomposedDishV2): boolean {
  const words = wordsOf;
  const said = new Set(words(phrase));
  return [dish.name, ...dish.ingredients.map((i) => i.rawName)].some((name) => {
    const named = words(name);
    const shared = named.filter((w) => said.has(w)).length;
    return shared > 0 && shared * 2 >= Math.min(named.length, said.size);
  });
}

/**
 * Hold Call 1's dish calories to the text, in place:
 * - a `statedKcal` the user did not type (nor a share, multiple or sum of
 *   typed figures) is removed, so the dish is estimated as usual;
 * - a figure the text writes right beside exactly one dish's name is that
 *   dish's: in a long list Call 1 sometimes shifts the figures by one food
 *   ("260kcal cá hồi, 23kcal rong biển" read as 23 for the salmon). It is
 *   moved there, and set there when Call 1 left it out and the text has no
 *   share or per-unit wording for it to have worked out;
 * - a figure beside ONE food of a dish with several, where the text names
 *   another of its foods too ("300kcal bánh mì kèm 2 trứng" merged into one
 *   dish), goes on that food (`statedKcal` on the ingredient): on the dish it
 *   would shrink the other foods into it.
 */
export function holdCaloriesToText(
  decomposition: MealDecompositionV2,
  mealText: string
): void {
  const text = mealText.normalize('NFC');
  const figures = typedKcals(text);
  const amounts = figures.map((f) => f.kcal);
  // A calorie figure is copied, not converted: only rounding to a whole
  // number separates two figures that are the same.
  const exact = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const dishes = decomposition.mealItems;

  // The one dish each figure sits beside, when there is exactly one.
  const besides = figures.map((figure) => {
    const span = { grams: figure.kcal, start: figure.start, end: figure.end };
    const phrases = [foodAfter(text, span), foodBefore(text, span)].filter(
      Boolean
    );
    const named = dishes.filter((d) => phrases.some((p) => namesDish(p, d)));
    if (named.length === 1) return named[0];
    // One figure and one dish: one shared word is enough, however Call 1
    // named the dish ("285kcal usual Starbuck coffee" → "Starbucks coffee
    // drink"). No shared word, and the figure may not be about food at all
    // ("1 tô phở bò, hôm nay còn dư 400 kcal").
    if (figures.length !== 1 || dishes.length !== 1) return null;
    const [dish] = dishes;
    const dishWords = new Set(
      [dish.name, ...dish.ingredients.map((i) => i.rawName)].flatMap(wordsOf)
    );
    return phrases.some((p) => wordsOf(p).some((w) => dishWords.has(w)))
      ? dish
      : null;
  });
  // A figure beside ONE food of a dish with several ("300kcal bánh mì kèm 2
  // trứng" merged into one dish) is that food's, not the dish's: setting the
  // whole dish to it would shrink the other foods into it. Only when the text
  // names another of the dish's foods elsewhere: parts Call 1 added on its
  // own (the milk and syrup of "285kcal Starbucks coffee") are inside the
  // figure.
  const textWords = new Set(wordsOf(text));
  const partOf = (
    dish: DecomposedDishV2,
    figure: TypedKcal
  ): DecomposedIngredientV2 | null => {
    if (dish.ingredients.length < 2) return null;
    const span = { grams: figure.kcal, start: figure.start, end: figure.end };
    for (const phrase of [foodAfter(text, span), foodBefore(text, span)]) {
      const part = foodNamedBy(phrase, dish);
      if (!part) continue;
      const said = new Set(wordsOf(phrase));
      const otherNamed = dish.ingredients.some(
        (other) =>
          other !== part &&
          wordsOf(other.rawName).some((w) => textWords.has(w) && !said.has(w))
      );
      if (otherNamed) return part;
    }
    return null;
  };
  for (const dish of dishes) {
    const own = figures.filter((_, i) => besides[i] === dish);
    const stated = dish.statedKcal;
    if (stated && !isTypedAmount(stated, amounts, text, exact)) {
      console.warn(
        `[call1-check] untyped calories ${stated} removed from dish "${dish.name}"`
      );
      delete dish.statedKcal;
    }
    const part = own.length === 1 ? partOf(dish, own[0]) : null;
    if (part) {
      // Call 1's figure for the dish stands for the food when it is this
      // figure or a share of it; with none, a share is Call 1's to work out.
      const figure = own[0].kcal;
      const forPart =
        dish.statedKcal && isTypedAmount(dish.statedKcal, [figure], text, exact)
          ? dish.statedKcal
          : SHARE_OR_EACH.test(text)
            ? undefined
            : figure;
      console.warn(
        `[call1-check] calories ${forPart ?? figure} beside "${part.rawName}" of dish "${dish.name}" are for that food`
      );
      delete dish.statedKcal;
      if (forPart) part.statedKcal = forPart;
      continue;
    }
    if (own.length !== 1) {
      // Every place the text writes Call 1's figure is beside another dish.
      const same = figures
        .map((f, i) => ({ f, beside: besides[i] }))
        .filter(({ f }) => stated && exact(f.kcal, stated));
      const elsewhere =
        same.length > 0 &&
        same.every(({ beside }) => beside && beside !== dish);
      if (elsewhere && own.length === 0) {
        console.warn(
          `[call1-check] calories ${dish.statedKcal} on dish "${dish.name}" belong to another dish`
        );
        delete dish.statedKcal;
      }
      continue;
    }
    const figure = own[0].kcal;
    // A figure the text gives for EACH of several ("2 hộp sữa 110kcal mỗi
    // hộp"): the dish is the figure times the count Call 1 read for it.
    const around = text.slice(Math.max(0, own[0].start - 12), own[0].end + 14);
    const counts = new Set(
      dish.ingredients.flatMap((i) =>
        i.count && i.count >= 2 ? [i.count] : []
      )
    );
    if (
      PER_UNIT.test(around) &&
      counts.size === 1 &&
      dish.statedKcal &&
      exact(dish.statedKcal, figure)
    ) {
      const [count] = counts;
      console.warn(
        `[call1-check] calories ${figure} each × ${count} set on dish "${dish.name}"`
      );
      dish.statedKcal = figure * count;
      continue;
    }
    // Call 1's own figure for this dish stands when it is this figure or a
    // share or multiple of it.
    if (
      dish.statedKcal &&
      isTypedAmount(dish.statedKcal, [figure], text, exact)
    )
      continue;
    if (!dish.statedKcal && SHARE_OR_EACH.test(text)) continue;
    console.warn(
      `[call1-check] calories ${figure} typed beside dish "${dish.name}" set on it (Call 1 wrote ${dish.statedKcal ?? 'none'})`
    );
    dish.statedKcal = figure;
  }
}
