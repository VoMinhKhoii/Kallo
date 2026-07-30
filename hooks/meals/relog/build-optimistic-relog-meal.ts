import { EMPTY_NUTRITION } from '@/hooks/meals/meal-mutation-helpers';
import type {
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import {
  buildRelogRawInput,
  type RelogStagedEntry,
  sumStagedMacros,
} from '@/lib/logging/relog/relog';

export interface RelogMealVariables {
  entries: RelogStagedEntry[];
  /** Client-generated id shared by the optimistic card and the persisted row. */
  newMealId: string;
  /** The day the relog lands on (= loggedDate). */
  originDate: string;
  loggedDate: string;
  timezoneOffset: number;
}

/**
 * The card shown the instant a relog is submitted, before the server responds.
 *
 * Numbers come from the candidate summaries the picker already displayed, so
 * what the staged totals promised is exactly what appears — and the authoritative
 * response overwrites it in place under the same id (no remount, no re-fade).
 *
 * `rawInput` uses the SAME derivation the server applies, so the optimistic
 * label can't disagree with the persisted one. Groups are listed without
 * ingredients: the picker never fetched them (deliberately — see the candidate
 * query), and the response fills them in milliseconds later.
 */
export function buildOptimisticRelogMeal(
  variables: RelogMealVariables
): PersistedMeal {
  const { entries, newMealId } = variables;
  const loggedAt = getUtcInstantForLocalDate(
    variables.loggedDate,
    variables.timezoneOffset
  ).toISOString();

  const mealItemGroups: PersistedMealItemGroup[] = entries.map(
    (entry, order) => ({
      name: entry.label,
      order,
      ingredients: [],
      nutrition: {
        ...EMPTY_NUTRITION,
        caloriesKcal: entry.summary.caloriesKcal,
        proteinG: entry.summary.proteinG,
        carbohydrateG: entry.summary.carbohydrateG,
        fatG: entry.summary.fatG,
      },
    })
  );

  return {
    id: newMealId,
    rawInput: buildRelogRawInput(entries.map((entry) => entry.label)),
    // Unknown until the server infers it from the write instant.
    mealSlot: null,
    // Unknown until the server merges the source meals' confidences; claiming
    // 'high' here would flash a confidence the meal may not have.
    confidenceOverall: null,
    loggedAt,
    nutrition: { ...EMPTY_NUTRITION, ...sumStagedMacros(entries) },
    mealItemGroups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    // Shared to circle by default; shareId arrives with the save response.
    share: { shareId: '', visibility: 'circle' },
    portionFactor: 1,
  };
}
