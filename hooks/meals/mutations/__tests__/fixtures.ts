// Shared fixtures for the per-mutation unit tests in this folder. Only inert
// data and render plumbing lives here — every `vi.mock` stays in the test file
// that needs it, because vitest hoists mocks per module.
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { ParsedMeal } from '@/lib/core/types/meal';
import type { CompleteManualMealRow } from '@/lib/domain/logging/manual-logging';
import { loggingDayKeys } from '@/lib/domain/meals/query-keys';

export const USER_ID = 'user-123';
export const DATE = '2026-05-29';
export const TZ = new Date().getTimezoneOffset();
// The active query keys on its tz offset; the mutation invalidates/updates with
// the 3-element key and relies on prefix matching. Mirror that here.
export const DAY_KEY = loggingDayKeys.byUserDateOffset(USER_ID, DATE, TZ);

export function makeParsedMeal(): ParsedMeal {
  return {
    mealName: 'Phở bò',
    items: [
      {
        id: 'item-1',
        name: 'Phở bò',
        quantity: 300,
        unit: 'g',
        macros: { calories: 450, protein: 30, carbs: 50, fat: 12 },
      },
    ],
    totalMacros: { calories: 450, protein: 30, carbs: 50, fat: 12 },
  };
}

// The confirm action now returns the authoritative saved meal; onSuccess
// overwrites the optimistic estimate with it. Tests assert the reconciled state,
// so the mock must return a meal matching the values under test.
export function savedMealResult(
  opts: { id?: string; calories?: number; protein?: number } = {}
) {
  const id = opts.id ?? 'meal-1';
  const base = Object.fromEntries(NUTRITION_KEYS.map((k) => [k, null]));
  const meal: PersistedMeal = {
    id,
    rawInput: 'Phở bò',
    mealSlot: null,
    confidenceOverall: null,
    loggedAt: '2026-05-29T01:00:00.000Z',
    nutrition: {
      ...base,
      caloriesKcal: opts.calories ?? 450,
      proteinG: opts.protein ?? 30,
      carbohydrateG: 50,
      fatG: 12,
    } as PersistedMeal['nutrition'],
    mealItemGroups: [],
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    share: null,
  };
  return { mealId: id, meal };
}

export function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

export function dayData(client: QueryClient): LoggingDayData | undefined {
  return client.getQueryData<LoggingDayData>(DAY_KEY);
}

export function makeManualRows(): CompleteManualMealRow[] {
  return [
    {
      id: 'row-1',
      query: 'cơm nhà nấu',
      grams: '150',
      ingredient: {
        id: 'fct-rice',
        namePrimary: 'Cơm trắng',
        nameEn: 'White rice',
        nameAlt: null,
        state: 'cooked',
        similarity: 0.9,
        per100g: {
          caloriesKcal: 130,
          proteinG: 2.7,
          carbohydrateG: 28,
          fatG: 0.3,
        },
      },
    },
  ];
}
