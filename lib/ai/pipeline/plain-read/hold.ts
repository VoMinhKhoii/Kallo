/**
 * Hold the pipeline's meal near the plain read (`plain-read.ts`).
 *
 * When the meal's shown calories sit more than `HOLD_BAND` away from the read,
 * its parts' nutrients are scaled by one factor so the total lands on the
 * band's edge. Each nutrient's low/mid/high scale together, so the parts keep
 * their split and confirm (which re-derives shown values from the bounded
 * triples) reproduces the held numbers. Grams are held the same way, but to
 * the read's grams: a meal can be wrong in calories because the row was wrong
 * and not the amount, and scaling grams by the calorie factor then spoils
 * grams that were right (Arena train, 194 meals: typical grams miss 16%
 * unheld, 20% scaled with the calories, 12% held to the read's grams). The shown values are goal-adjusted, so
 * the hold is measured on what the user sees, after the cut/bulk shift — and
 * because that shift is linear in the triple, scaling commutes with it.
 *
 * A part whose amount the user typed (`typedAmount`: a weight, a weighed dish,
 * calories for its dish) is never moved. The other parts are held to what the
 * read gives those same parts, once each typed part is found in the read's
 * food list; when one is not, they are moved, within 2×, to bring the meal's
 * total to the band.
 */
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type {
  PipelineMealItem,
  PipelineResult,
  ProcessedIngredient,
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
  /** What the moved parts' grams were scaled by. */
  gramsFactor: number;
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
 * The read's calories and grams for the parts the user typed an amount for,
 * or null when they cannot be told. The read repeats a typed weight as that food's
 * grams (and typed calories as its calories), so each typed part is paired
 * with the read's food of the same grams or calories: a whole typed dish
 * first, else its parts one by one.
 */
function readOfTypedParts(
  result: PipelineResult,
  read: PlainRead
): { kcal: number; grams: number } | null {
  const foods = [...read.foods];
  // By the amount the user typed: typed calories pair on calories alone (the
  // part's grams are an estimate, and would pair it with another food that
  // happens to weigh the same); a typed weight pairs on grams, the closest in
  // calories when several weigh the same.
  const take = (by: 'grams' | 'kcal', grams: number, kcal: number | null) => {
    let at = -1;
    if (by === 'kcal') {
      if (kcal != null) at = foods.findIndex((f) => same(f.kcal, kcal));
    } else {
      foods.forEach((f, i) => {
        if (!same(f.grams, grams)) return;
        const closer =
          kcal != null &&
          Math.abs(f.kcal - kcal) < Math.abs(foods[at]?.kcal - kcal);
        if (at < 0 || closer) at = i;
      });
    }
    return at < 0 ? null : foods.splice(at, 1)[0];
  };
  const kcalOf = (v: NutritionValues) => v.caloriesKcal ?? null;
  const total = { kcal: 0, grams: 0 };
  const add = (food: PlainRead['foods'][number]) => {
    total.kcal += food.kcal;
    total.grams += food.grams;
  };
  for (const mi of result.mealItems) {
    const typed = mi.ingredients.filter((ing) => ing.typedAmount);
    if (typed.length === 0) continue;
    const by = (ing: ProcessedIngredient) => ing.typedAmount ?? 'grams';
    if (
      typed.length > 1 &&
      typed.length === mi.ingredients.length &&
      typed.every((ing) => by(ing) === by(typed[0]))
    ) {
      const dish = take(
        by(typed[0]),
        typed.reduce((g, ing) => g + ing.estimatedGrams, 0),
        kcalOf(mi.displayedNutrition)
      );
      if (dish != null) {
        add(dish);
        continue;
      }
    }
    for (const ing of typed) {
      const food = take(
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
  const unchanged = (outcome: HoldOutcome): HoldResult => ({
    result,
    outcome,
    appKcal,
    readKcal,
    factor: 1,
    gramsFactor: 1,
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
  let gramsFactor: number;
  const readTyped =
    typedKcal > 0 ? readOfTypedParts(result, args.read) : { kcal: 0, grams: 0 };
  if (readTyped != null) {
    // The other parts are held to the read's figures for those same parts:
    // calories to its calories, grams to its grams.
    const readFree = readKcal - readTyped.kcal;
    if (!(readFree > 0)) return unchanged('typed_parts');
    factor = holdFactor(freeKcal, readFree);
    const readFreeGrams =
      args.read.foods.reduce((g, f) => g + f.grams, 0) - readTyped.grams;
    gramsFactor =
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
    gramsFactor = factor;
  }
  const still = (f: number) => Math.abs(f - 1) < 1e-6;
  if (still(factor) && still(gramsFactor)) return unchanged('within_band');
  return {
    result: scaleFreeParts(result, factor, gramsFactor),
    outcome: 'held',
    appKcal,
    readKcal,
    factor,
    gramsFactor,
  };
}

/** `total` with `before` taken out and `after` put in, per nutrient. */
export function swapNutritionValues(
  total: NutritionValues,
  before: NutritionValues,
  after: NutritionValues
): NutritionValues {
  const out = { ...total };
  for (const key of Object.keys(out) as (keyof NutritionValues)[]) {
    const t = out[key];
    if (t != null) out[key] = t - (before[key] ?? 0) + (after[key] ?? 0);
  }
  return out;
}

export function swapBoundedNutrition(
  total: BoundedNutrition,
  before: BoundedNutrition,
  after: BoundedNutrition
): BoundedNutrition {
  const out = { ...total };
  for (const key of Object.keys(out) as (keyof BoundedNutrition)[]) {
    const t = out[key];
    if (t == null) continue;
    const b = before[key];
    const a = after[key];
    out[key] = {
      low: t.low - (b?.low ?? 0) + (a?.low ?? 0),
      mid: t.mid - (b?.mid ?? 0) + (a?.mid ?? 0),
      high: t.high - (b?.high ?? 0) + (a?.high ?? 0),
    };
  }
  return out;
}

/** `result` with one meal item replaced and the meal totals moved with it. */
export function replaceMealItem(
  result: PipelineResult,
  index: number,
  next: PipelineMealItem
): PipelineResult {
  const before = result.mealItems[index];
  return {
    ...result,
    mealItems: result.mealItems.map((mi, i) => (i === index ? next : mi)),
    boundedNutrition: swapBoundedNutrition(
      result.boundedNutrition,
      before.boundedNutrition,
      next.boundedNutrition
    ),
    displayedNutrition: swapNutritionValues(
      result.displayedNutrition,
      before.displayedNutrition,
      next.displayedNutrition
    ),
  };
}

/**
 * Scale every part the user gave no amount for, nutrients by `f` and grams by
 * `gramsF`; dish and meal totals follow.
 */
function scaleFreeParts(
  result: PipelineResult,
  f: number,
  gramsF: number
): PipelineResult {
  return result.mealItems.reduce((held, mi, index) => {
    let item = mi;
    for (const ing of mi.ingredients) {
      if (ing.typedAmount) continue;
      const scaled = scaleIngredient(ing, f, gramsF);
      item = {
        ...item,
        ingredients: item.ingredients.map((i) => (i === ing ? scaled : i)),
        boundedNutrition: swapBoundedNutrition(
          item.boundedNutrition,
          ing.boundedNutrition,
          scaled.boundedNutrition
        ),
        displayedNutrition: swapNutritionValues(
          item.displayedNutrition,
          ing.displayedNutrition,
          scaled.displayedNutrition
        ),
      };
    }
    return item === mi ? held : replaceMealItem(held, index, item);
  }, result);
}

function scaleIngredient(
  ing: ProcessedIngredient,
  f: number,
  gramsF: number
): ProcessedIngredient {
  return {
    ...ing,
    estimatedGrams: ing.estimatedGrams * gramsF,
    rawEquivalentGrams: ing.rawEquivalentGrams * gramsF,
    boundedNutrition: scaleBoundedNutrition(ing.boundedNutrition, f),
    displayedNutrition: scaleNutritionValues(ing.displayedNutrition, f),
    ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * f }),
  };
}

export function scaleNutritionValues(
  v: NutritionValues,
  f: number
): NutritionValues {
  const out = { ...v };
  for (const key of Object.keys(out) as (keyof NutritionValues)[]) {
    const x = out[key];
    if (x != null) out[key] = x * f;
  }
  return out;
}

export function scaleBoundedNutrition(
  b: BoundedNutrition,
  f: number
): BoundedNutrition {
  const out = { ...b };
  for (const key of Object.keys(out) as (keyof BoundedNutrition)[]) {
    const e = out[key];
    if (e != null)
      out[key] = { low: e.low * f, mid: e.mid * f, high: e.high * f };
  }
  return out;
}
