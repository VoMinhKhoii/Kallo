import { MAX_FOOD_ITEM_GRAMS } from '@/lib/core/validation/food-limits';
import {
  canStepServingMultiplier,
  MIN_SERVING_MULTIPLIER,
  stepServingMultiplier,
} from '@/lib/domain/meals/serving-ladder';
import type { ScanFood } from '@/lib/domain/scan/food';

/**
 * How much of a `ScanFood` is being logged: a count of servings, a count of
 * packs, or a custom amount in the food's unit. Pure, so the result's Portion
 * and Amount rows are testable without a component. Mirrors the Flutter app's
 * `ScanAmount` (`logic/scan/amount.dart`).
 */
export type ScanPortion = 'serving' | 'pack' | 'custom';

/** The most one entry may log, in the food's unit (g or ml). */
export const MAX_SCAN_AMOUNT = MAX_FOOD_ITEM_GRAMS;
/** Smallest positive resolved amount (e.g. a quarter of a 1-serving food). */
export const MIN_RESOLVED_SCAN_AMOUNT = 0.01;
/** The most servings — or packs — one entry holds. */
export const MAX_SERVINGS = 99;
/** One press of a custom amount's − / +, in g or ml. Fine enough to land on a
 *  real portion; typing covers anything finer. */
export const CUSTOM_STEP = 10;

export interface ScanAmount {
  portion: ScanPortion;
  servings: number;
  packs: number;
  /** The custom amount, in the food's unit. */
  custom: number;
}

const clampCustom = (amount: number) =>
  Math.min(MAX_SCAN_AMOUNT, Math.max(1, amount));

const clampResolved = (amount: number) =>
  Math.min(MAX_SCAN_AMOUNT, Math.max(MIN_RESOLVED_SCAN_AMOUNT, amount));

/** The most servings or packs of `size` one entry holds: MAX_SERVINGS, or
 *  fewer when that many would pass MAX_SCAN_AMOUNT — so the count on screen is
 *  always the amount logged (99 packs of 2 kg would not be). */
const maxCount = (size: number | null) =>
  size === null || size <= 0
    ? MAX_SERVINGS
    : Math.max(
        MIN_SERVING_MULTIPLIER,
        Math.min(MAX_SERVINGS, MAX_SCAN_AMOUNT / size)
      );

/** The portions `food` can be logged by, in menu order: serving when the
 *  source gives a serving size or the food's unit IS "serving"; pack when the
 *  source gives a pack size; custom for g/ml foods only — never for a
 *  serving-only food, where custom would just duplicate serving counts. */
export function portionsFor(food: ScanFood): ScanPortion[] {
  const portions: ScanPortion[] = [];
  if (food.servingSize !== null || food.unit === 'serving') {
    portions.push('serving');
  }
  if (food.packageSize !== null) portions.push('pack');
  if (food.unit !== 'serving') portions.push('custom');
  return portions;
}

/** One serving when the food has one, else its pack, else its basis. */
export function initialScanAmount(food: ScanFood): ScanAmount {
  return {
    portion: portionsFor(food)[0],
    servings: 1,
    packs: 1,
    custom: clampCustom(
      food.servingSize ?? food.packageSize ?? food.basisAmount
    ),
  };
}

/** The amount a selection logs, in the food's unit. */
export function resolveScanAmount(amount: ScanAmount, food: ScanFood): number {
  switch (amount.portion) {
    case 'serving':
      return clampResolved(
        amount.servings * (food.servingSize ?? food.basisAmount)
      );
    case 'pack':
      return clampResolved(
        amount.packs * (food.packageSize ?? food.basisAmount)
      );
    case 'custom':
      return clampCustom(amount.custom);
  }
}

/** The − / + of the Amount row for the current portion. */
export function stepScanAmount(
  amount: ScanAmount,
  food: ScanFood,
  direction: 1 | -1
): ScanAmount {
  switch (amount.portion) {
    case 'serving':
      return {
        ...amount,
        servings: stepServingMultiplier(
          amount.servings,
          direction,
          maxCount(food.servingSize)
        ),
      };
    case 'pack':
      return {
        ...amount,
        packs: stepServingMultiplier(
          amount.packs,
          direction,
          maxCount(food.packageSize)
        ),
      };
    case 'custom':
      return {
        ...amount,
        custom: clampCustom(amount.custom + direction * CUSTOM_STEP),
      };
  }
}

export function canStepScanAmount(
  amount: ScanAmount,
  food: ScanFood,
  direction: 1 | -1
): boolean {
  switch (amount.portion) {
    case 'serving':
      return canStepServingMultiplier(
        amount.servings,
        direction,
        maxCount(food.servingSize)
      );
    case 'pack':
      return canStepServingMultiplier(
        amount.packs,
        direction,
        maxCount(food.packageSize)
      );
    case 'custom':
      return direction < 0
        ? amount.custom > 1
        : amount.custom < MAX_SCAN_AMOUNT;
  }
}

/** Switch portion, carrying the current amount into custom so "Custom" starts
 *  from what was on screen rather than jumping. Rounded to a whole g/ml for
 *  the numeric field so what the field shows matches what Add logs. */
export function withPortion(
  amount: ScanAmount,
  food: ScanFood,
  portion: ScanPortion
): ScanAmount {
  if (portion === 'custom' && amount.portion !== 'custom') {
    const resolved = resolveScanAmount(amount, food);
    return { ...amount, portion, custom: clampCustom(Math.round(resolved)) };
  }
  return { ...amount, portion };
}

/** A typed or cup-picked custom amount, inside the log's limits. */
export function withCustom(amount: ScanAmount, custom: number): ScanAmount {
  return { ...amount, portion: 'custom', custom: clampCustom(custom) };
}

/** A size as a pack prints it: whole numbers drop the ".0", and a litre or a
 *  kilo or more reads L / kg — "100 ml", "1 L", "1.5 kg". */
export function formatSize(value: number, unit: string): string {
  const trim = (v: number) => String(Math.round(v * 10) / 10);
  if (value >= 1000 && (unit === 'ml' || unit === 'g')) {
    return `${trim(value / 1000)} ${unit === 'ml' ? 'L' : 'kg'}`;
  }
  return `${trim(value)} ${unit}`;
}

/** The amount chosen for `before`, when it still means the same for `after`
 *  — an edit that kept the unit and the serving and pack sizes; else null, so
 *  the result starts again from one serving. */
export function carryAmount(
  amount: ScanAmount | null,
  before: ScanFood,
  after: ScanFood
): ScanAmount | null {
  return amount !== null &&
    before.unit === after.unit &&
    before.servingSize === after.servingSize &&
    before.packageSize === after.packageSize
    ? amount
    : null;
}
