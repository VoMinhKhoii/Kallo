/**
 * Hold the pipeline's meal near the plain read (`plain-read.ts`).
 *
 * When the meal's shown calories sit more than `HOLD_BAND` away from the read,
 * every part is scaled by one factor so the total lands on the band's edge.
 * Grams and each nutrient's low/mid/high all scale together, so the parts keep
 * their split and confirm (which re-derives shown values from the bounded
 * triples) reproduces the held numbers. The shown values are goal-adjusted, so
 * the hold is measured on what the user sees, after the cut/bulk shift — and
 * because that shift is linear in the triple, scaling commutes with it.
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

/** How far the meal may sit from the read before it is held (±10%). */
export const HOLD_BAND = 0.1;
/**
 * The largest factor the hold applies either way. Benchmark factors ran
 * 0.30×–4.3×; past this the read is more likely wrong than the meal.
 */
export const MAX_HOLD_FACTOR = 5;

/**
 * A weight the user typed ("150g thịt bò", "2 lạng", "8 oz steak", "nửa ký
 * thịt bò", "half a pound of beef"). Those meals are left as computed: the hold
 * was never measured on them, and scaling would change grams the user wrote
 * themselves. A false match ("pound cake") only leaves a meal unheld.
 */
/** Short unit symbols, which only mean a weight right after a number. */
const NUMBER_THEN_SYMBOL = /\d\s*(?:g|gr|kg|ml|l|oz|lbs?)(?![\p{L}\p{N}])/iu;
/** Unit words, which mean a weight with or without a number ("nửa ký"). */
const UNIT_WORD =
  /(?<![\p{L}\p{N}])(?:grams?|gam|kilos?|kilograms?|ký|kí|lạng|lít|liters?|litres?|ounces?|pounds?)(?![\p{L}\p{N}])/iu;

export function hasTypedWeight(mealText: string): boolean {
  // NFC first: "lạng" / "ký" typed in decomposed form must still match.
  const text = mealText.normalize('NFC');
  return NUMBER_THEN_SYMBOL.test(text) || UNIT_WORD.test(text);
}

export type HoldOutcome =
  | 'held'
  | 'within_band'
  | 'no_read'
  | 'typed_weight'
  | 'no_calories';

export interface HoldResult {
  result: PipelineResult;
  outcome: HoldOutcome;
  /** The meal's shown calories before the hold. */
  appKcal: number | null;
  readKcal: number | null;
  factor: number;
}

/** The factor that moves `appKcal` to the nearest edge of the band, or 1. */
export function holdFactor(appKcal: number, readKcal: number): number {
  const low = readKcal / (1 + HOLD_BAND);
  const high = readKcal * (1 + HOLD_BAND);
  if (appKcal >= low && appKcal <= high) return 1;
  const raw = (appKcal > high ? high : low) / appKcal;
  return Math.min(MAX_HOLD_FACTOR, Math.max(1 / MAX_HOLD_FACTOR, raw));
}

export function holdToPlainRead(
  result: PipelineResult,
  args: { readKcal: number | null; typedWeight: boolean }
): HoldResult {
  const appKcal = result.displayedNutrition.caloriesKcal;
  const unchanged = (outcome: HoldOutcome): HoldResult => ({
    result,
    outcome,
    appKcal,
    readKcal: args.readKcal,
    factor: 1,
  });
  if (args.typedWeight) return unchanged('typed_weight');
  if (args.readKcal == null) return unchanged('no_read');
  if (appKcal == null || !(appKcal > 0)) return unchanged('no_calories');

  const factor = holdFactor(appKcal, args.readKcal);
  if (factor === 1) return unchanged('within_band');
  return {
    result: scaleResult(result, factor),
    outcome: 'held',
    appKcal,
    readKcal: args.readKcal,
    factor,
  };
}

function scaleResult(result: PipelineResult, f: number): PipelineResult {
  return {
    ...result,
    mealItems: result.mealItems.map((mi) => scaleMealItem(mi, f)),
    boundedNutrition: scaleBounded(result.boundedNutrition, f),
    displayedNutrition: scaleValues(result.displayedNutrition, f),
  };
}

function scaleMealItem(mi: PipelineMealItem, f: number): PipelineMealItem {
  return {
    ...mi,
    ingredients: mi.ingredients.map((ing) => scaleIngredient(ing, f)),
    boundedNutrition: scaleBounded(mi.boundedNutrition, f),
    displayedNutrition: scaleValues(mi.displayedNutrition, f),
  };
}

function scaleIngredient(
  ing: ProcessedIngredient,
  f: number
): ProcessedIngredient {
  return {
    ...ing,
    estimatedGrams: ing.estimatedGrams * f,
    rawEquivalentGrams: ing.rawEquivalentGrams * f,
    boundedNutrition: scaleBounded(ing.boundedNutrition, f),
    displayedNutrition: scaleValues(ing.displayedNutrition, f),
    ...(ing.alcoholG != null && { alcoholG: ing.alcoholG * f }),
  };
}

function scaleValues(v: NutritionValues, f: number): NutritionValues {
  const out = { ...v };
  for (const key of Object.keys(out) as (keyof NutritionValues)[]) {
    const x = out[key];
    if (x != null) out[key] = x * f;
  }
  return out;
}

function scaleBounded(b: BoundedNutrition, f: number): BoundedNutrition {
  const out = { ...b };
  for (const key of Object.keys(out) as (keyof BoundedNutrition)[]) {
    const e = out[key];
    if (e != null)
      out[key] = { low: e.low * f, mid: e.mid * f, high: e.high * f };
  }
  return out;
}
