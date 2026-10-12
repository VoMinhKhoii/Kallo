'use client';

import type {
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import type { SaveManualMealInput } from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import {
  type CompleteManualMealRow,
  manualMealTitle,
  rowLabel,
  rowMacros,
  totalsForRows,
} from '@/lib/domain/logging/manual-logging';
import { EMPTY_NUTRITION } from './nutrition-row';

export type SaveManualMealVariables = Omit<
  SaveManualMealInput,
  'mealId' | 'items'
> & {
  mealId: string;
  originDate: string;
  rows: CompleteManualMealRow[];
};

// Build the optimistic persisted meal from the per-100g macros already held by
// the form rows. Micros are left null; the server response fills them in.
export function buildOptimisticManualMeal(
  variables: SaveManualMealVariables
): PersistedMeal {
  const { rows, mealId } = variables;
  // Same derivation the server applies — no second source of truth.
  const loggedAt = getUtcInstantForLocalDate(
    variables.loggedDate,
    variables.timezoneOffset
  ).toISOString();
  const nutrition = { ...EMPTY_NUTRITION, ...totalsForRows(rows) };
  // Trimmed the way the contract trims it, so a blank name is no name here too.
  const name = variables.name?.trim() || undefined;
  // Same grouping the server applies: a named meal is one dish, an unnamed
  // one is a dish per ingredient.
  const groups: PersistedMealItemGroup[] = name
    ? [{ name, order: 0, ingredients: [], nutrition }]
    : rows.map((row, order) => ({
        name: rowLabel(row),
        order,
        ingredients: [],
        nutrition: { ...EMPTY_NUTRITION, ...rowMacros(row) },
      }));
  return {
    // Same id the server will persist — one stable React key from optimistic
    // insert through reconciliation (no re-fade).
    id: mealId,
    rawInput: manualMealTitle(name, rows.map(rowLabel)),
    mealSlot: variables.mealSlot ?? null,
    confidenceOverall: 'high',
    loggedAt,
    nutrition,
    mealItemGroups: groups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    // Private until the save response says otherwise. The Circle auto-share
    // preference lives server-side and is off by default, so guessing
    // 'circle' here would briefly show a meal as shared that never was.
    share: null,
  };
}
