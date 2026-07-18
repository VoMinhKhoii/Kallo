'use client';

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyMealsKeys } from '@/hooks/meals/use-daily-meals';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import type { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import type {
  LoggingDayData,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { NutritionValues } from '@/lib/ai/types';
import type { SaveManualMealInput } from '@/lib/api/contracts/meals';
import { resolveSliderNutrition } from '@/lib/cheat/slider-nutrition';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { invalidateFeedQueries } from '@/lib/groups/feed-cache';
import {
  type CompleteManualMealRow,
  parseGrams,
  rowLabel,
  rowMacros,
  totalsForRows,
} from '@/lib/logging/manual-logging';
import { recalculateTotals } from '@/lib/meal-utils';
import type { CheatSliderLevels, CheatSliderSpec } from '@/lib/types/cheat';
import type { MacroBreakdown, MealItem, ParsedMeal } from '@/lib/types/meal';

export interface OptimisticCheatInput {
  spec: CheatSliderSpec;
  levels: CheatSliderLevels;
}

export type QuantityEdit = NonNullable<
  Parameters<typeof confirmAndSaveMealAction>[0]['edits']
>[number];

export function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const EMPTY_NUTRITION = Object.fromEntries(
  NUTRITION_KEYS.map((key) => [key, null])
) as unknown as NutritionValues;

export function macrosToNutrition(macros: MacroBreakdown): NutritionValues {
  return {
    ...EMPTY_NUTRITION,
    caloriesKcal: macros.calories,
    proteinG: macros.protein,
    carbohydrateG: macros.carbs,
    fatG: macros.fat,
  };
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

// Replace the list item whose id matches `meal.id`, or append it if absent.
export function upsertById(
  list: PersistedMeal[],
  meal: PersistedMeal
): PersistedMeal[] {
  return list.some((m) => m.id === meal.id)
    ? list.map((m) => (m.id === meal.id ? meal : m))
    : [...list, meal];
}

// Put the confirmed meal into a cached logging-day, idempotently: replace the
// row sharing its stable id (the optimistic insert) with this one, or append it
// if absent, and drop the matching pending confirmation (manual saves have no
// pending confirmation — pass undefined). Shared by onMutate (the
// optimistic estimate) and onSuccess (the authoritative server meal from the
// confirm response, which overwrites the estimate in place — same id, so no
// remount/re-fade — and is the reason no day refetch is needed to reconcile).
export function mergeConfirmedMealIntoDay(
  old: LoggingDayData | undefined,
  meal: PersistedMeal,
  analysisId?: string
): LoggingDayData {
  if (!old) {
    // Entry exists but its initial load is still in flight (data undefined).
    // Seed it so the ring reflects this meal immediately. Note: setQueriesData
    // only runs this updater for already-cached query entries; it cannot create
    // one where the query is unmounted.
    return { persistedMeals: [meal], pendingConfirmations: [] };
  }
  return {
    persistedMeals: upsertById(old.persistedMeals, meal),
    pendingConfirmations: analysisId
      ? old.pendingConfirmations.filter((p) => p.id !== analysisId)
      : old.pendingConfirmations,
  };
}

// Upsert a meal into the dashboard's daily-meals list (a bare PersistedMeal[]).
// Returns `old` untouched when the query isn't cached, so we never fabricate a
// list for a dashboard that was never mounted (it should refetch on next mount).
export function upsertMealIntoList(
  old: PersistedMeal[] | undefined,
  meal: PersistedMeal
): PersistedMeal[] | undefined {
  if (!old) return old;
  return upsertById(old, meal);
}

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

// ---------------------------------------------------------------------------
// Shared save choreography (useConfirmMeal + useSaveManualMeal)
// ---------------------------------------------------------------------------

/** onMutate: cancel in-flight day fetches, snapshot, upsert the optimistic
 *  meal into the cached day. Returns the rollback snapshots. */
export async function applyOptimisticMeal(
  queryClient: QueryClient,
  userId: string,
  originDate: string,
  optimisticMeal: PersistedMeal,
  analysisId?: string
) {
  const filter = { queryKey: loggingDayKeys.byUserDate(userId, originDate) };
  await queryClient.cancelQueries(filter);
  const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
  queryClient.setQueriesData<LoggingDayData>(filter, (old) =>
    mergeConfirmedMealIntoDay(old, optimisticMeal, analysisId)
  );
  return { snapshots };
}

/**
 * onSuccess: reconcile straight from the save response — the server returns
 * the saved meal in its authoritative shape, so we overwrite the optimistic
 * estimate in place (same id → no remount/re-fade) rather than waiting for a
 * day refetch. Any day fetch still in flight is cancelled BEFORE the write:
 * such a fetch read the PRE-save snapshot and would clobber the write when it
 * lands; the cancellations are AWAITED so an in-flight fetch can't resolve
 * between the cancel and the setQueriesData below.
 */
export async function reconcileSavedMeal(
  queryClient: QueryClient,
  userId: string,
  originDate: string,
  savedMeal: PersistedMeal | undefined,
  analysisId?: string
) {
  const loggingDayKey = loggingDayKeys.byUserDate(userId, originDate);
  const dailyMealsKey = dailyMealsKeys.byDate(originDate);
  await Promise.all([
    queryClient.cancelQueries({ queryKey: loggingDayKey }),
    queryClient.cancelQueries({ queryKey: dailyMealsKey }),
  ]);
  if (!savedMeal) {
    // Defensive (the web actions always return `meal`): if a version-skewed
    // response omits it, fall back to a refetch so the ring reconciles
    // instead of keeping the optimistic estimate stuck.
    queryClient.invalidateQueries({ queryKey: loggingDayKey });
    queryClient.invalidateQueries({ queryKey: dailyMealsKey });
    return;
  }
  queryClient.setQueriesData<LoggingDayData>(
    { queryKey: loggingDayKey },
    (old) => mergeConfirmedMealIntoDay(old, savedMeal, analysisId)
  );
  // Keep the dashboard ring in sync instantly when its daily-meals query is
  // already mounted; an unmounted one is marked stale by the invalidate on
  // settle and refetches on its next mount.
  queryClient.setQueriesData<PersistedMeal[]>(
    { queryKey: dailyMealsKey },
    (old) => upsertMealIntoList(old, savedMeal)
  );
}

/** onError: restore the pre-mutation snapshots and surface the failure. */
export function rollbackOptimisticMeal(
  queryClient: QueryClient,
  error: unknown,
  context: { snapshots?: ReturnType<QueryClient['getQueriesData']> } | undefined
) {
  if (context?.snapshots) {
    for (const [key, data] of context.snapshots) {
      queryClient.setQueryData(key, data);
    }
  }
  toast.error(error instanceof Error ? error.message : 'Không thể lưu bữa ăn.');
}

/**
 * onSettled: on success, onSuccess already wrote authoritative state — mark
 * the day queries stale WITHOUT a refetch (refetchType 'none' = no network);
 * an unmounted surface (e.g. the dashboard while logging) refreshes on its
 * next mount. On error the optimistic insert was rolled back; refetch
 * actively to heal in case a cancelled in-flight fetch left a surface behind.
 * meal-dates (timeline dots) has no optimistic path; refresh it normally.
 */
export function settleMealSave(
  queryClient: QueryClient,
  userId: string,
  originDate: string,
  error: unknown,
  extraKeys: readonly QueryKey[] = []
) {
  const refetchType = error ? 'active' : 'none';
  queryClient.invalidateQueries({
    queryKey: loggingDayKeys.byUserDate(userId, originDate),
    refetchType,
  });
  queryClient.invalidateQueries({
    queryKey: dailyMealsKeys.byDate(originDate),
    refetchType,
  });
  queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
  invalidateFeedQueries(queryClient);
  for (const key of extraKeys) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

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

/**
 * Save a manually-composed meal (ingredient ids + grams — no AI, no pending
 * analysis). Cache choreography mirrors useConfirmMeal: optimistic upsert into
 * the logging-day prefix key, in-place authoritative overwrite on success,
 * snapshot rollback on error.
 */
