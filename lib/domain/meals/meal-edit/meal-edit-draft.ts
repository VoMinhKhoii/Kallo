/**
 * The meal edit dialog's state: every dish's current grams, the whole-meal
 * multiplier, and the arithmetic the Servings / Amount / Size controls run.
 *
 * One model for both lives of a meal. A saved meal's dish is the ingredient
 * rows it was logged as; an unsaved one's is the single staged item. Either
 * way a dish scales as ONE thing — every gram-bearing part by the same ratio —
 * so the dialog never edits an ingredient on its own.
 *
 * The Dart twin is `apps/mobile-flutter/lib/features/logging/logic/meal_edit/
 * meal_edit_draft.dart`; keep the two in step.
 */
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';
import { MIN_DISH_GRAMS } from '@/lib/domain/meals/quantity-recalculation';
import {
  MIN_SERVING_MULTIPLIER,
  stepServingMultiplier,
} from '@/lib/domain/meals/serving-ladder';

/** Amount moves in tens, the step the old steppers used. */
export const AMOUNT_STEP = 10;

/** Lowest positive weight/count a scaled dish can drop to (never 0, which the
 *  update endpoint rejects). */
export const MIN_EDIT_GRAMS = 0.01;

/**
 * What one part of a dish contributes, at the grams it was logged at. A null
 * `grams` is a legacy row with no recorded amount: it cannot scale, so it keeps
 * its nutrition as is. A null macro stays null — never read as 0.
 */
export interface EditPart {
  /** The `meal_items` row id on a saved meal; undefined on an unsaved one. */
  id?: string;
  grams: number | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface EditTotals {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface EditDish {
  /** Stable identity: `order:name` on a saved meal, the item id otherwise. */
  key: string;
  name: string;
  unit: 'g' | 'ml' | 'serving';
  parts: EditPart[];
  /** The dish's grams (or serving count when `unit === 'serving'`) now — what
   *  the dialog shows and what is saved. */
  grams: number;
  /**
   * The amount the Whole meal multiplier asked for, before clamping to
   * {@link MIN_EDIT_GRAMS}. Kept apart from `grams` so taking the whole meal
   * down and back up returns a dish that hit the floor to where it started.
   * Defaults to `grams`.
   */
  target?: number;
  /** The vessel the pipeline pictured it in — unsaved dishes only. */
  vessel?: ClientVessel;
}

export interface MealEditDraft {
  dishes: EditDish[];
  /** The Whole meal multiplier, along the serving ladder from 1. */
  whole: number;
  /**
   * Whether a dish may be taken out. Only a saved meal can drop a dish: the
   * unsaved confirm scales dishes but has no way to leave one out.
   */
  canRemove: boolean;
}

/**
 * Float slack only. A wider tolerance skipped real half-serving steps: 460 g of
 * a 450 g dish stepped down to 225 g instead of back to 450 g.
 */
const EPS = 1e-6;

/**
 * Whether a part moves with its dish: only a row with a positive weight. A null
 * or zero-gram legacy row keeps its nutrition as is — `updateMealAction` leaves
 * non-positive rows untouched, so scaling one here would preview a number the
 * save never writes.
 */
export function partScales(part: EditPart): boolean {
  return (part.grams ?? 0) > 0;
}

/** The grams as logged: the sum of the parts that scale. */
export function originalGrams(dish: EditDish): number {
  return dish.parts.reduce(
    (sum, p) => sum + (partScales(p) ? (p.grams as number) : 0),
    0
  );
}

/** False for a dish whose parts carry no grams at all — nothing to step. */
export function isScalable(dish: EditDish): boolean {
  return originalGrams(dish) > 0;
}

/** How much of the logged amount this is: 1 as logged, 2 for double. */
export function servingsOf(dish: EditDish): number {
  const base = originalGrams(dish);
  return base > 0 ? dish.grams / base : 1;
}

/**
 * The least the ±10 g/ml Amount stepper (and Size picker) can step a dish down
 * to: MIN_DISH_GRAMS, or what it was logged at when that is less. A 5 g pat of
 * butter stays 5 g on Amount minus — Servings and Whole meal can still scale it
 * down along the fractional ladder.
 */
export function floorOf(dish: EditDish): number {
  return Math.min(MIN_DISH_GRAMS, originalGrams(dish));
}

/** True when no step down is left: the next minus would remove the dish. */
export function atBottom(dish: EditDish): boolean {
  return (
    !isScalable(dish) ||
    servingsOf(dish) <= MIN_SERVING_MULTIPLIER + EPS ||
    dish.grams <= MIN_EDIT_GRAMS + EPS
  );
}

/** A user's own adjustment, kept strictly positive. */
export function withGrams(dish: EditDish, next: number): EditDish {
  const grams = Math.max(MIN_EDIT_GRAMS, next);
  return { ...dish, grams, target: grams };
}

/** The Whole meal multiplier: scales the target, clamped only at
 *  {@link MIN_EDIT_GRAMS} so small or per-serving dishes still scale down. */
function scaledBy(dish: EditDish, factor: number): EditDish {
  const target = (dish.target ?? dish.grams) * factor;
  return { ...dish, grams: Math.max(MIN_EDIT_GRAMS, target), target };
}

/** The dish at exactly `grams` — for pricing a committed amount, not an edit. */
export function atGrams(dish: EditDish, grams: number): EditDish {
  return { ...dish, grams, target: grams };
}

const MACROS = ['kcal', 'protein', 'carbs', 'fat'] as const;

/** Each dish's parts scaled by its own ratio, summed per macro. */
export function sumTotals(dishes: EditDish[]): EditTotals {
  const totals: EditTotals = {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  };
  for (const dish of dishes) {
    const ratio = servingsOf(dish);
    for (const part of dish.parts) {
      const scale = partScales(part) ? ratio : 1;
      for (const key of MACROS) {
        const value = part[key];
        if (value == null) continue;
        totals[key] = (totals[key] ?? 0) + value * scale;
      }
    }
  }
  return totals;
}

export function findDish(
  draft: MealEditDraft,
  key: string
): EditDish | undefined {
  return draft.dishes.find((d) => d.key === key);
}

/**
 * True when Servings' minus would take this dish out rather than shrink it: at
 * the bottom rung (`0.25×`), at `MIN_EDIT_GRAMS`, or for a dish with no grams
 * to step.
 */
export function removesOnMinus(draft: MealEditDraft, dish: EditDish): boolean {
  return atBottom(dish) && draft.canRemove && draft.dishes.length > 1;
}

/** True when Servings' minus can do nothing at all. */
export function servingsMinusDisabled(
  draft: MealEditDraft,
  dish: EditDish
): boolean {
  return atBottom(dish) && !removesOnMinus(draft, dish);
}

/** True when Amount's −10 g/ml button cannot shrink the dish any further. */
export function amountMinusDisabled(dish: EditDish): boolean {
  return dish.grams <= floorOf(dish) + EPS;
}

function mapDish(
  draft: MealEditDraft,
  key: string,
  fn: (d: EditDish) => EditDish
): MealEditDraft {
  return {
    ...draft,
    dishes: draft.dishes.map((d) => (d.key === key ? fn(d) : d)),
  };
}

export function removeDish(draft: MealEditDraft, key: string): MealEditDraft {
  if (!draft.canRemove || draft.dishes.length <= 1) return draft;
  return { ...draft, dishes: draft.dishes.filter((d) => d.key !== key) };
}

/** Up or down to the next rung on the serving ladder (`0.25, 1/3, 0.5, 2/3,
 *  0.75, 1, 1.5, 2, ...`). */
export function stepServings(
  draft: MealEditDraft,
  key: string,
  direction: 1 | -1
): MealEditDraft {
  const dish = findDish(draft, key);
  if (!dish) return draft;
  if (direction < 0 && removesOnMinus(draft, dish))
    return removeDish(draft, key);
  if (
    !isScalable(dish) ||
    (direction < 0 && servingsMinusDisabled(draft, dish))
  )
    return draft;
  const next = stepServingMultiplier(servingsOf(dish), direction);
  return mapDish(draft, key, (d) => withGrams(d, originalGrams(d) * next));
}

/** Ten grams either way, from the rounded figure the row shows, held at
 *  {@link floorOf}. */
export function stepAmount(
  draft: MealEditDraft,
  key: string,
  direction: 1 | -1
): MealEditDraft {
  return mapDish(draft, key, (d) =>
    withGrams(
      d,
      Math.max(floorOf(d), Math.round(d.grams) + direction * AMOUNT_STEP)
    )
  );
}

/** Exact grams, from the Size picker, held at {@link floorOf}. */
export function setDishGrams(
  draft: MealEditDraft,
  key: string,
  grams: number
): MealEditDraft {
  return mapDish(draft, key, (d) => withGrams(d, Math.max(floorOf(d), grams)));
}

/** Every dish by the same factor, stepping along the serving ladder. */
export function stepWhole(
  draft: MealEditDraft,
  direction: 1 | -1
): MealEditDraft {
  const next = stepServingMultiplier(draft.whole, direction);
  if (Math.abs(next - draft.whole) < EPS) return draft;
  const factor = next / draft.whole;
  return {
    ...draft,
    whole: next,
    dishes: draft.dishes.map((d) => (isScalable(d) ? scaledBy(d, factor) : d)),
  };
}
