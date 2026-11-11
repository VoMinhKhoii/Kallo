/**
 * What the user typed, carried onto the finished meal.
 *
 * - Calories typed for a dish ("160kcal sữa chua", a label or a menu figure)
 *   are a fact, like a typed weight. Call 1 reports them as the dish's
 *   `statedKcal` (checked against the text in `text-checks.ts`); here the
 *   finished dish is set to that figure. Only the nutrients move, by one
 *   factor, so the parts keep their split and every macro follows the
 *   calories. Grams stay as estimated: the typed figure says how much energy
 *   the food has, not how much of it there was. The shown values are
 *   goal-adjusted and linear in the bounded triples, so scaling the triples by
 *   typed ÷ shown lands the shown calories on the typed figure, and confirm
 *   (which re-derives shown values from the triples) reproduces it.
 * - Every part whose amount the user typed is marked `typedAmount`, so the
 *   plain-read hold (`plain-read/hold.ts`) moves only the other parts.
 */
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { RESCUE_TYPED_PART_PORTION } from '@/lib/ai/pipeline/grounded/rescue/splice';
import {
  replaceMealItem,
  scaleBoundedNutrition,
  scaleNutritionValues,
  swapBoundedNutrition,
  swapNutritionValues,
} from '@/lib/ai/pipeline/plain-read/hold';
import { portionAnchor } from '@/lib/ai/pipeline/resolve/refuse-mass';
import type { PortionResolution } from '@/lib/ai/portion/types';
import type { PipelineMealItem, PipelineResult } from '@/lib/ai/types/result';

function scaleNutrients(mi: PipelineMealItem, f: number): PipelineMealItem {
  return {
    ...mi,
    ingredients: mi.ingredients.map((ing) => ({
      ...ing,
      boundedNutrition: scaleBoundedNutrition(ing.boundedNutrition, f),
      displayedNutrition: scaleNutritionValues(ing.displayedNutrition, f),
      ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * f }),
    })),
    boundedNutrition: scaleBoundedNutrition(mi.boundedNutrition, f),
    displayedNutrition: scaleNutritionValues(mi.displayedNutrition, f),
  };
}

/** The result's meal item for a dish of Call 1's list: same place, same name. */
function itemOf(
  result: PipelineResult,
  dish: { name: string },
  index: number
): PipelineMealItem | null {
  const mi = result.mealItems[index];
  return mi?.name.toLocaleLowerCase() === dish.name.toLocaleLowerCase()
    ? mi
    : null;
}

type TypedDish = {
  name: string;
  statedKcal?: number;
  ingredients?: ReadonlyArray<{ statedKcal?: number }>;
};

/** One part of a dish set to the calories typed for it; the dish totals follow. */
function withPartCalories(
  mi: PipelineMealItem,
  at: number,
  kcal: number
): PipelineMealItem {
  const ing = mi.ingredients[at];
  const shown = ing?.displayedNutrition.caloriesKcal;
  if (!ing || shown == null || !(shown > 0)) return mi;
  const f = kcal / shown;
  const scaled = {
    ...ing,
    boundedNutrition: scaleBoundedNutrition(ing.boundedNutrition, f),
    displayedNutrition: scaleNutritionValues(ing.displayedNutrition, f),
    ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * f }),
  };
  return {
    ...mi,
    ingredients: mi.ingredients.map((i, n) => (n === at ? scaled : i)),
    boundedNutrition: swapBoundedNutrition(
      mi.boundedNutrition,
      ing.boundedNutrition,
      scaled.boundedNutrition
    ),
    displayedNutrition: swapNutritionValues(
      mi.displayedNutrition,
      ing.displayedNutrition,
      scaled.displayedNutrition
    ),
  };
}

/**
 * Set every dish, or single food of a dish, the user typed calories for to
 * that figure. `dishes` is Call 1's final dish list, in the result's order. A
 * dish that came out with no calories at all has nothing to scale and is left
 * as it is.
 */
export function holdToTypedCalories(
  result: PipelineResult,
  dishes: ReadonlyArray<TypedDish>
): PipelineResult {
  return dishes.reduce((held, dish, index) => {
    const mi = itemOf(held, dish, index);
    if (!mi) return held;
    if (!dish.statedKcal) {
      const parts = dish.ingredients ?? [];
      if (parts.length !== mi.ingredients.length) return held;
      const next = parts.reduce(
        (item, part, at) =>
          part.statedKcal ? withPartCalories(item, at, part.statedKcal) : item,
        mi
      );
      return next === mi ? held : replaceMealItem(held, index, next);
    }
    const shown = mi.displayedNutrition.caloriesKcal;
    if (shown == null || !(shown > 0)) {
      console.warn(
        `[typed-kcal] "${dish.name}" has no calories to set to the typed ${dish.statedKcal}`
      );
      return held;
    }
    console.info(
      `[typed-kcal] "${dish.name}" ${Math.round(shown)} → ${dish.statedKcal} kcal`
    );
    return replaceMealItem(
      held,
      index,
      scaleNutrients(mi, dish.statedKcal / shown)
    );
  }, result);
}

/**
 * Mark the parts whose amount the user typed: a part with a weight or package
 * size of its own (or the foods the rescue split such a part into), and every part of a dish the user weighed or typed calories
 * for. `portions` runs over Call 1's ingredients in order, as the result's
 * parts do; a dish whose parts do not line up is marked whole, so nothing in
 * it is moved by mistake.
 */
export function markTypedParts(
  result: PipelineResult,
  decomposition: MealDecompositionV2,
  portions: ReadonlyArray<PortionResolution | undefined>
): PipelineResult {
  let flat = 0;
  const mealItems = result.mealItems.map((mi, index) => {
    const dish = decomposition.mealItems[index];
    const start = flat;
    flat += dish?.ingredients.length ?? 0;
    if (!dish) return mi;
    const aligned =
      itemOf(result, dish, index) !== null &&
      dish.ingredients.length === mi.ingredients.length;
    // Which amount is the user's: the calories, or else the grams. The hold
    // finds a typed part in the plain read by that amount.
    const wholeDish: 'grams' | 'kcal' | null = dish.statedKcal
      ? 'kcal'
      : !aligned || dish.servedMassG
        ? 'grams'
        : null;
    const typed = mi.ingredients.map((_, i): 'grams' | 'kcal' | null => {
      if (wholeDish) return wholeDish;
      if (dish.ingredients[i]?.statedKcal) return 'kcal';
      return portionAnchor(portions[start + i]) !== null ||
        portions[start + i] === RESCUE_TYPED_PART_PORTION
        ? 'grams'
        : null;
    });
    if (!typed.some(Boolean)) return mi;
    return {
      ...mi,
      ingredients: mi.ingredients.map((ing, i) => {
        const typedAmount = typed[i];
        return typedAmount ? { ...ing, typedAmount } : ing;
      }),
    };
  });
  return { ...result, mealItems };
}
