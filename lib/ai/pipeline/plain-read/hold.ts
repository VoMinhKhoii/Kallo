/**
 * Hold the pipeline's meal near the plain read (`plain-read.ts`).
 *
 * When the meal's shown calories sit more than `HOLD_BAND` away from the read,
 * its unlocked parts' nutrients and grams are scaled by the same `factor` so
 * the total lands on the band's edge while every ingredient keeps its food
 * table's real calorie density (`kcal/g`). Scaling grams and calories by
 * different factors breaks food physics whenever one side lists broth, water,
 * or ice that the other omitted.
 *
 * The raw grams multiplier the read implied (`rawGramsFactor`) is still
 * computed and returned on `HoldResult`: when it diverges sharply from
 * `factor`, `runSeeingRescue` (`rescue.ts`) inspects the ingredient table with
 * Sonnet to diagnose whether the cause is missing water/broth or a wrong food
 * row, instead of scaling blindly.
 *
 * A part whose amount the user typed (`typedAmount`: a weight, a weighed dish,
 * calories for its dish) is never moved. The other parts are held to what the
 * read gives those same parts, once each typed part is found in the read's
 * food list; when one is not, they are moved, within 2×, to bring the meal's
 * total to the band.
 */

import {
  mapIngredients,
  scaleBoundedNutrition,
  scaleNutritionValues,
} from '@/lib/ai/pipeline/assemble/result-scale';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import type {
  PipelineResult,
  ProcessedIngredient,
  TypedAmount,
} from '@/lib/ai/types/result';
import type { PlainRead } from './prompt';

/** How far the meal may sit from the read before it is held (±10%). */
export const HOLD_BAND = 0.1;
/**
 * The largest factor the hold applies either way. Benchmark factors ran
 * 0.30×–4.3×; past this the read is more likely wrong than the meal.
 */
export const MAX_HOLD_FACTOR = 5;

export type HoldOutcome =
  | 'held'
  | 'rescued'
  | 'within_band'
  | 'no_read'
  | 'typed_parts'
  | 'no_calories';

export interface HoldResult {
  result: PipelineResult;
  outcome: HoldOutcome;
  /** The meal's shown calories before the hold. */
  appKcal: number | null;
  readKcal: number | null;
  /** What the moved parts' nutrients were scaled by. */
  factor: number;
  /** What the moved parts' grams were scaled by (matches `factor` in `holdToPlainRead`). */
  gramsFactor: number;
  /**
   * The grams multiplier implied by the read's food weights alone, before
   * coupling grams to `factor`. A large gap between `factor` and
   * `rawGramsFactor` signals a structural or food-row mismatch for `rescue.ts`.
   */
  rawGramsFactor: number;
}

/** A hold without the meal it returns: what logs and caches record. */
export type HoldSummary = Omit<HoldResult, 'result'>;

export function summarizeHold({
  result: _,
  ...summary
}: HoldResult): HoldSummary {
  return summary;
}

/** The factor that moves `appKcal` to the nearest edge of the band, or 1. */
export function holdFactor(appKcal: number, readKcal: number): number {
  const low = readKcal / (1 + HOLD_BAND);
  const high = readKcal * (1 + HOLD_BAND);
  if (appKcal >= low && appKcal <= high) return 1;
  const raw = (appKcal > high ? high : low) / appKcal;
  return Math.min(MAX_HOLD_FACTOR, Math.max(1 / MAX_HOLD_FACTOR, raw));
}

/** Grams or calories the read and the meal give the same food: within 3% (2 at least). */
const same = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(2, 0.03 * Math.max(a, b));

/**
 * Take from `foods` the read's food for a part the user typed an amount for.
 * A typed weight pairs with the food of the same grams, typed calories with
 * the one of the same calories (the part's grams are then an estimate, and
 * would pair it with another food that happens to weigh the same). When
 * several match, the closest in the other amount, so the read's order never
 * decides.
 */
function takeClosest(
  foods: PlainRead['foods'],
  by: TypedAmount,
  grams: number,
  kcal: number | null
): PlainRead['foods'][number] | null {
  if (by === 'kcal' && kcal == null) return null;
  let at = -1;
  let gap = Number.POSITIVE_INFINITY;
  foods.forEach((f, i) => {
    const matches =
      by === 'kcal' ? same(f.kcal, kcal ?? 0) : same(f.grams, grams);
    if (!matches) return;
    const other =
      by === 'kcal'
        ? Math.abs(f.grams - grams)
        : kcal == null
          ? 0
          : Math.abs(f.kcal - kcal);
    if (at < 0 || other < gap) {
      at = i;
      gap = other;
    }
  });
  return at < 0 ? null : foods.splice(at, 1)[0];
}

/**
 * The read's calories and grams for the parts the user typed an amount for,
 * or null when they cannot be told. The read repeats a typed weight as that food's
 * grams (and typed calories as its calories), so each typed part is paired
 * with the read's food of the same grams or calories: a dish typed whole
 * (`typedWhole`) as one food, parts typed one by one each on their own.
 */
function readOfTypedParts(
  result: PipelineResult,
  read: PlainRead
): { kcal: number; grams: number } | null {
  const foods = [...read.foods];
  const kcalOf = (v: NutritionValues) => v.caloriesKcal ?? null;
  const by = (ing: ProcessedIngredient) => ing.typedAmount ?? 'grams';
  const total = { kcal: 0, grams: 0 };
  const add = (food: PlainRead['foods'][number]) => {
    total.kcal += food.kcal;
    total.grams += food.grams;
  };
  for (const mi of result.mealItems) {
    const typed = mi.ingredients.filter((ing) => ing.typedAmount);
    if (typed.length === 0) continue;
    // A dish typed whole is one food of the read: its parts' grams are
    // estimates and would pair with other foods of the same weight.
    if (mi.typedWhole) {
      const dish = takeClosest(
        foods,
        mi.typedWhole,
        typed.reduce((g, ing) => g + ing.estimatedGrams, 0),
        kcalOf(mi.displayedNutrition)
      );
      if (dish == null) return null;
      add(dish);
      continue;
    }
    // Parts typed one by one are in the read one by one; their sum must not
    // be taken for another food that happens to weigh as much.
    for (const ing of typed) {
      const food = takeClosest(
        foods,
        by(ing),
        ing.estimatedGrams,
        kcalOf(ing.displayedNutrition)
      );
      if (food == null) return null;
      add(food);
    }
  }
  return total;
}

/**
 * How far the other parts may move when the read's figure for the typed parts
 * cannot be told: the two totals may then differ over a food the user typed,
 * and the rest should not absorb all of that.
 */
const MAX_BLIND_FACTOR = 2;

export function holdToPlainRead(
  result: PipelineResult,
  args: { read: PlainRead | null }
): HoldResult {
  const appKcal = result.displayedNutrition.caloriesKcal;
  const readKcal = args.read?.totalKcal ?? null;
  const unchanged = (outcome: HoldOutcome, rawGramsFactor = 1): HoldResult => ({
    result,
    outcome,
    appKcal,
    readKcal,
    factor: 1,
    gramsFactor: 1,
    rawGramsFactor,
  });
  if (args.read == null || readKcal == null) return unchanged('no_read');
  if (appKcal == null || !(appKcal > 0)) return unchanged('no_calories');

  // What the user typed stays; only the other parts move.
  const typedKcal = result.mealItems
    .flatMap((mi) => mi.ingredients)
    .filter((ing) => ing.typedAmount)
    .reduce((t, ing) => t + (ing.displayedNutrition.caloriesKcal ?? 0), 0);
  const freeKcal = appKcal - typedKcal;
  // Under 1 kcal free is rounding left over from the sums, not a part.
  if (typedKcal > 0 && !(freeKcal >= 1)) return unchanged('typed_parts');

  const parts = result.mealItems.flatMap((mi) => mi.ingredients);
  const freeGrams = parts
    .filter((ing) => !ing.typedAmount)
    .reduce((g, ing) => g + ing.estimatedGrams, 0);
  let factor: number;
  let rawGramsFactor: number;
  // Whenever a part is typed, even one with no calories (200 g of water):
  // its grams are in the read's total too and must come out of the target.
  const readTyped = parts.some((ing) => ing.typedAmount)
    ? readOfTypedParts(result, args.read)
    : { kcal: 0, grams: 0 };
  if (readTyped != null) {
    // The other parts are held to the read's calories, and grams move with
    // calories so every food keeps its table's real calorie density.
    // `rawGramsFactor` records what the read's weights alone implied so the
    // seeing rescue can catch large calorie-vs-gram disagreements.
    const readFree = readKcal - readTyped.kcal;
    if (!(readFree > 0)) return unchanged('typed_parts');
    factor = holdFactor(freeKcal, readFree);
    const readFreeGrams =
      args.read.foods.reduce((g, f) => g + f.grams, 0) - readTyped.grams;
    rawGramsFactor =
      freeGrams > 0 && readFreeGrams > 0
        ? holdFactor(freeGrams, readFreeGrams)
        : factor;
  } else {
    // The whole meal is held to the read's total by moving the other parts,
    // unless the typed parts alone already reach it: squeezing the rest to
    // fit would crush it. The read's grams for those parts cannot be told
    // either, so grams follow the calories.
    const target = appKcal * holdFactor(appKcal, readKcal);
    if (target <= typedKcal) return unchanged('typed_parts');
    factor = Math.min(
      MAX_BLIND_FACTOR,
      Math.max(1 / MAX_BLIND_FACTOR, (target - typedKcal) / freeKcal)
    );
    rawGramsFactor = factor;
  }
  const gramsFactor = factor;
  const still = (f: number) => Math.abs(f - 1) < 1e-6;
  if (still(factor)) return unchanged('within_band', rawGramsFactor);
  return {
    result: scaleFreeParts(result, factor),
    outcome: 'held',
    appKcal,
    readKcal,
    factor,
    gramsFactor,
    rawGramsFactor,
  };
}

/**
 * Scale every part the user gave no amount for (nutrients and grams together by
 * `f`); dish and meal totals follow.
 */
function scaleFreeParts(result: PipelineResult, f: number): PipelineResult {
  return mapIngredients(result, (ing) =>
    ing.typedAmount ? ing : scaleIngredient(ing, f)
  );
}

function scaleIngredient(
  ing: ProcessedIngredient,
  f: number
): ProcessedIngredient {
  return {
    ...ing,
    estimatedGrams: ing.estimatedGrams * f,
    rawEquivalentGrams: ing.rawEquivalentGrams * f,
    boundedNutrition: scaleBoundedNutrition(ing.boundedNutrition, f),
    displayedNutrition: scaleNutritionValues(ing.displayedNutrition, f),
    ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * f }),
  };
}
