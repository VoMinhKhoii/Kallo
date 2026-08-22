'use client';

import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';

// Pure, idempotent shape changes to the two cached meal collections. They hold
// no QueryClient — save-choreography.ts owns the cache calls, these own what
// the new value looks like.

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
