import { createContext, useContext } from 'react';
import {
  buildMealDateIndex,
  type MealDateIndex,
} from '@/lib/domain/logging/meal-date-index';
import { meetsCompletenessFloor } from '@/lib/domain/nutrition/pattern/completeness';

export interface DayProgressSource {
  mealDates: MealDateIndex;
  calorieTarget: number | null;
}

/** A day with a known total, measured against a usable target. */
export interface MeasuredDay {
  kcal: number;
  target: number;
  /** Share of the target eaten; over target runs past 1. */
  fraction: number;
  met: boolean;
}

/**
 * The one reading of a day's progress, shared by the ring (drawn) and the day
 * button's accessible name (spoken), so the two cannot disagree.
 *
 * Null when there is nothing to measure: no target, or a day whose total is
 * unknown — a staged card, a legacy meal without calories, an empty day.
 * Drawing an arc for those would be inventing a number.
 */
export function measureDay(
  { mealDates, calorieTarget }: DayProgressSource,
  date: string
): MeasuredDay | null {
  const kcal = mealDates.kcal(date);
  if (kcal === null || calorieTarget === null || calorieTarget <= 0) {
    return null;
  }
  return {
    kcal,
    target: calorieTarget,
    fraction: kcal / calorieTarget,
    met: meetsCompletenessFloor(kcal, calorieTarget),
  };
}

/**
 * What the day buttons read their rings from.
 *
 * Context rather than a closure: DayPicker takes `components.DayButton` as a
 * component TYPE, so building one per render around the panel's props would
 * hand React a new type every time and remount all ~35 buttons — focus
 * included, which is the one thing a keyboard user cannot afford to lose.
 * The default measures nothing, so a button rendered outside the panel draws
 * bare tracks rather than needing a branch of its own.
 */
export const DayProgressContext = createContext<DayProgressSource>({
  mealDates: buildMealDateIndex([]),
  calorieTarget: null,
});

export function useMeasuredDay(date: string): MeasuredDay | null {
  return measureDay(useContext(DayProgressContext), date);
}
