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
  foodsBeside,
  isTypedWeight,
  near,
  type TypedWeight,
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
export function foodNamedBy(
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
    for (const phrase of foodsBeside(text, weight)) {
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
