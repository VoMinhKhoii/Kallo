'use client';

import type {
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import type { SaveManualMealInput } from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import {
  type CompleteManualMealRow,
  parseGrams,
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
  const groups: PersistedMealItemGroup[] = rows.map((row, order) => ({
    name: rowLabel(row),
    order,
    ingredients: [],
    nutrition: { ...EMPTY_NUTRITION, ...rowMacros(row) },
  }));
  return {
    // Same id the server will persist — one stable React key from optimistic
    // insert through reconciliation (no re-fade).
    id: mealId,
    rawInput: rows
      .map((row) => `${parseGrams(row.grams)}g ${rowLabel(row)}`)
      .join(', '),
    mealSlot: variables.mealSlot ?? null,
    confidenceOverall: 'high',
    loggedAt,
    nutrition: { ...EMPTY_NUTRITION, ...totalsForRows(rows) },
    mealItemGroups: groups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    // Shared to circle by default. shareId is left empty optimistically (the
    // real one arrives with the save response); the toggle reads only
    // visibility for its pressed state, and the Macro Card button stays hidden
    // until a server shareId is present.
    share: { shareId: '', visibility: 'circle' },
  };
}
