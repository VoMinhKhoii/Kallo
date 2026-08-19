'use client';

import type { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import type {
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import type {
  CheatSliderLevels,
  CheatSliderSpec,
} from '@/lib/core/types/cheat';
import type { MealItem, ParsedMeal } from '@/lib/core/types/meal';
import { resolveSliderNutrition } from '@/lib/domain/cheat/slider-nutrition';
import { recalculateTotals } from '@/lib/domain/meals/quantity-recalculation';
import { macrosToNutrition } from './nutrition-row';

export interface OptimisticCheatInput {
  spec: CheatSliderSpec;
  levels: CheatSliderLevels;
}

export type QuantityEdit = NonNullable<
  Parameters<typeof confirmAndSaveMealAction>[0]['edits']
>[number];

// Client-supplied data needed to build the optimistic meal without reading the
// pending confirmation back out of the cache. Stripped before the server call.
// `mealId` is REQUIRED here (the server schema keeps it optional for the mobile
// REST route): the optimistic insert and the authoritative onSuccess write must
// share one id, otherwise they'd be two rows and the ring would double-count.
export type ConfirmMealVariables = Omit<
  Parameters<typeof confirmAndSaveMealAction>[0],
  'mealId'
> & {
  mealId: string;
  originDate: string;
  parsedMeal: ParsedMeal;
  rawInput: string;
  loggedAt: string;
  /** Present for cheat meals — seeds the optimistic cheat card. */
  cheat?: OptimisticCheatInput;
};

export function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Apply dish-level quantity edits so the optimistic card shows the user's
// adjusted values immediately, instead of the original AI estimate until the
// refetch lands. Per-ingredient edits are left to the server-backed refetch.
export function applyEditsToItems(
  items: MealItem[],
  edits: QuantityEdit[] | undefined
): MealItem[] {
  const newGramsByOrder = new Map<number, number>();
  for (const edit of edits ?? []) {
    if (edit.ingredientIndex === undefined) {
      newGramsByOrder.set(edit.mealItemOrder, edit.newGrams);
    }
  }
  if (newGramsByOrder.size === 0) return items;

  return items.map((item, order) => {
    const newGrams = newGramsByOrder.get(order);
    if (newGrams === undefined || item.quantity <= 0) return item;
    const ratio = newGrams / item.quantity;
    return {
      ...item,
      quantity: newGrams,
      macros: {
        calories: item.macros.calories * ratio,
        protein: item.macros.protein * ratio,
        carbs: item.macros.carbs * ratio,
        fat: item.macros.fat * ratio,
      },
    };
  });
}

// Build the optimistic persisted meal from data the caller already holds (the
// streamed analysis result), rather than re-reading the pending confirmation
// from the query cache. The cached pending row may not have landed yet when the
// user confirms (esp. the first meal of the day), so depending on it caused the
// optimistic update to silently no-op and the calorie ring to stay stale.
export function buildOptimisticMeal(
  parsedMeal: ParsedMeal,
  rawInput: string,
  loggedAt: string,
  mealId: string,
  edits?: QuantityEdit[],
  cheat?: OptimisticCheatInput
): PersistedMeal {
  // Cheat meal: resolve nutrition from the chosen slider levels (the same helper
  // the server uses on confirm), and carry the spec/levels so the card renders
  // the cheat variant immediately. onSuccess later overwrites this in place with
  // the authoritative server meal (same id).
  if (cheat) {
    const resolved = resolveSliderNutrition(cheat.spec, cheat.levels);
    return {
      id: mealId,
      rawInput,
      mealSlot: cheat.spec.mealSlot,
      confidenceOverall: cheat.spec.confidence,
      loggedAt,
      nutrition: macrosToNutrition({
        calories: resolved.caloriesKcal,
        protein: resolved.proteinG,
        carbs: resolved.carbohydrateG,
        fat: resolved.fatG,
      }),
      mealItemGroups: [],
      entryMode: 'cheat',
      alcoholG: resolved.alcoholG,
      cheatSliders: { spec: cheat.spec, levels: cheat.levels },
      // Shared to circle by default. shareId is left empty optimistically (the
      // real one arrives with the confirm response); the toggle reads only
      // visibility for its pressed state, and the Macro Card button stays hidden
      // until a server shareId is present.
      share: { shareId: '', visibility: 'circle' },
    };
  }

  const items = applyEditsToItems(parsedMeal.items, edits);
  const groups: PersistedMealItemGroup[] = items.map((item, order) => ({
    name: item.name,
    order,
    ingredients: [],
    nutrition: macrosToNutrition(item.macros),
  }));
  const total = edits?.length
    ? recalculateTotals(items)
    : parsedMeal.totalMacros;
  return {
    // Same id the server will persist, so the card keeps one stable React key
    // from optimistic insert through the post-save refetch (no re-fade).
    id: mealId,
    rawInput,
    mealSlot: null,
    confidenceOverall: null,
    loggedAt,
    nutrition: macrosToNutrition(total),
    mealItemGroups: groups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    // Shared to circle by default. shareId is left empty optimistically (the
    // real one arrives with the confirm response); the toggle reads only
    // visibility for its pressed state, and the Macro Card button stays hidden
    // until a server shareId is present.
    share: { shareId: '', visibility: 'circle' },
  };
}
