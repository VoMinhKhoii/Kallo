/**
 * Call 1's calorie figures held to the text the user typed: a figure the user
 * did not type is removed, and a typed one is put on the dish, or the one
 * food, named beside it.
 */
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import {
  foodsBeside,
  isTypedAmount,
  type TypedKcal,
  typedKcals,
  wordBag,
  wordsOf,
} from './typed-amounts';
import { foodNamedBy } from './weights';

/** Words that make a typed figure a share or a per-unit amount, which only Call 1 reads. */
const SHARE_OR_EACH =
  /(?<!\p{L})(?:nửa|half|chia|share[ds]?|split|phần|third|quarter|mỗi|each|per)(?!\p{L})|[½⅓¼%]|\d\s*\/\s*\d/iu;

/** A figure stated per unit: "110kcal mỗi hộp", "80 kcal each", "90 kcal/gói". */
const PER_UNIT =
  /(?<!\p{L})(?:mỗi|each|per|apiece)(?!\p{L})|(?:kcals?|calo|calories?|cals?)\s*\/\s*\p{L}/iu;

/** The dish a food phrase from the text names: most of the shorter name's words are shared. */
function namesDish(phrase: string, dish: DecomposedDishV2): boolean {
  const words = wordsOf;
  const said = wordBag(words(phrase));
  return [dish.name, ...dish.ingredients.map((i) => i.rawName)].some((name) => {
    const named = words(name);
    const shared = named.filter((w) => said.has(w)).length;
    return shared > 0 && shared * 2 >= Math.min(named.length, said.size);
  });
}

/**
 * Words that make a calorie figure about the person's day, not about a food:
 * what is left of a budget, a goal, a deficit.
 */
const DAY_WORDS =
  /(?<!\p{L})(?:còn dư|còn lại|còn thiếu|mục tiêu|thâm hụt|remaining|budget|goal|target|deficit)(?!\p{L})/iu;
const LEFT_AFTER = /^\s*(?:left|remaining)(?!\p{L})/iu;

/** "1 tô phở bò, hôm nay còn dư 400 kcal": the 400 is no food's calories. */
function isAboutTheDay(text: string, figure: TypedKcal): boolean {
  // The figure's own clause: back to a comma, a line break or a sentence end
  // (a period before a space; "1.5" is a number).
  const before = text.slice(0, figure.start);
  let from = 0;
  for (const m of before.matchAll(/[,;!?\n]|\.(?=\s)/g)) from = m.index + 1;
  return (
    DAY_WORDS.test(text.slice(from, figure.end)) ||
    LEFT_AFTER.test(text.slice(figure.end))
  );
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
  const figures = typedKcals(text).filter((f) => !isAboutTheDay(text, f));
  const amounts = figures.map((f) => f.kcal);
  // A calorie figure is copied, not converted: only rounding to a whole
  // number separates two figures that are the same.
  const exact = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const dishes = decomposition.mealItems;

  /** The words typed around a figure name the dish or one of its foods. */
  const sharesWord = (figure: TypedKcal, dish: DecomposedDishV2) => {
    const dishWords = wordBag(
      [dish.name, ...dish.ingredients.map((i) => i.rawName)].flatMap(wordsOf)
    );
    return foodsBeside(text, figure).some((p) =>
      wordsOf(p).some((w) => dishWords.has(w))
    );
  };
  // The one dish each figure sits beside, when there is exactly one.
  const besides = figures.map((figure) => {
    const phrases = foodsBeside(text, figure).filter(Boolean);
    const named = dishes.filter((d) => phrases.some((p) => namesDish(p, d)));
    if (named.length === 1) return named[0];
    // One figure and one dish: one shared word is enough, however Call 1
    // named the dish ("285kcal usual Starbuck coffee" → "Starbucks coffee
    // drink"). No shared word, and the figure may not be about food at all
    // ("1 tô phở bò, hôm nay còn dư 400 kcal").
    if (figures.length !== 1 || dishes.length !== 1) return null;
    return sharesWord(figure, dishes[0]) ? dishes[0] : null;
  });
  // A figure beside ONE food of a dish with several ("300kcal bánh mì kèm 2
  // trứng" merged into one dish) is that food's, not the dish's: setting the
  // whole dish to it would shrink the other foods into it. Only when the text
  // names another of the dish's foods elsewhere: parts Call 1 added on its
  // own (the milk and syrup of "285kcal Starbucks coffee") are inside the
  // figure.
  const textWords = wordBag(wordsOf(text));
  const partOf = (
    dish: DecomposedDishV2,
    figure: TypedKcal
  ): DecomposedIngredientV2 | null => {
    if (dish.ingredients.length < 2) return null;
    for (const phrase of foodsBeside(text, figure)) {
      const part = foodNamedBy(phrase, dish);
      if (!part) continue;
      const said = wordBag(wordsOf(phrase));
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
