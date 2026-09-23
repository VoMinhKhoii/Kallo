import { createContext, useContext } from 'react';
import type { MealDateIndex } from '@/lib/domain/logging/meal-date-index';
import { meetsCompletenessFloor } from '@/lib/domain/nutrition/pattern/completeness';

export interface DayProgressSource {
  mealDates: MealDateIndex;
  calorieTarget: number | null;
}

export interface DayProgress {
  /** Share of the target eaten; 0 for a day with nothing countable. */
  fraction: number;
  met: boolean;
}

/**
 * What the day buttons read their rings from.
 *
 * Context rather than a closure: DayPicker takes `components.DayButton` as a
 * component TYPE, so building one per render around the panel's props would
 * hand React a new type every time and remount all ~35 buttons — focus
 * included, which is the one thing a keyboard user cannot afford to lose.
 */
export const DayProgressContext = createContext<DayProgressSource | null>(null);

/** A day's ring, or null outside a provider (no ring is drawn then). */
export function useDayProgress(date: string): DayProgress | null {
  const source = useContext(DayProgressContext);
  if (!source) return null;

  const kcal = source.mealDates.kcal(date);
  const target = source.calorieTarget;
  // A day whose total is unknown (a staged card, a legacy meal without
  // calories) still gets its track: it is a past day like any other, and
  // drawing an arc for it would be inventing a number.
  if (kcal === null || target === null || target <= 0) {
    return { fraction: 0, met: false };
  }
  return {
    fraction: kcal / target,
    met: meetsCompletenessFloor(kcal, target),
  };
}
