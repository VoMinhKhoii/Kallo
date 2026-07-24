'use client';

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyMealsKeys } from '@/hooks/meals/use-daily-meals';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { invalidateFeedQueries } from '@/lib/groups/feed-cache';
import {
  mergeConfirmedMealIntoDay,
  upsertMealIntoList,
} from './meal-mutation-helpers';

// ---------------------------------------------------------------------------
// Shared save choreography (useConfirmMeal + useSaveManualMeal + useDuplicateMeal)
//
// The onMutate/onSuccess/onError/onSettled cache moves for a meal save, split
// out from the optimistic-meal builders in meal-mutation-helpers so each file
// stays a single concern (and under the file-size limit).
// ---------------------------------------------------------------------------

/** onMutate: cancel in-flight day fetches, snapshot, upsert the optimistic
 *  meal into the cached day. Returns the rollback snapshots plus a flag for
 *  whether our cancel killed a logging-day fetch that was actually in flight.
 *
 *  `dayFetchCancelled` invariant: any fetch our cancel here aborts carried
 *  state (the day's server meals) that we then can't trust the cache to hold —
 *  whether it was the INITIAL load or a PRIOR save's heal refetch. The snapshot
 *  can't distinguish the latter: cancelling a prior heal reverts the cache to
 *  that save's (defined) seed, so the snapshot looks defined even though the
 *  never-loaded server meals are still missing. Capturing the fetch-in-flight
 *  status BEFORE the cancel lets onSuccess re-arm the post-write active refetch
 *  in exactly that case. (`isInvalidated` is deliberately NOT the signal —
 *  settleMealSave marks the day invalidated on every save, so it would fire a
 *  heal after every save and defeat the no-refetch fast path.) */
export async function applyOptimisticMeal(
  queryClient: QueryClient,
  userId: string,
  originDate: string,
  optimisticMeal: PersistedMeal,
  analysisId?: string
) {
  const filter = { queryKey: loggingDayKeys.byUserDate(userId, originDate) };
  const dayFetchCancelled = queryClient
    .getQueryCache()
    .findAll(filter)
    .some((q) => q.state.fetchStatus === 'fetching');
  await queryClient.cancelQueries(filter);
  const snapshots = queryClient.getQueriesData<LoggingDayData>(filter);
  queryClient.setQueriesData<LoggingDayData>(filter, (old) =>
    mergeConfirmedMealIntoDay(old, optimisticMeal, analysisId)
  );
  return { snapshots, dayFetchCancelled };
}

/**
 * onSuccess: reconcile straight from the save response — the server returns
 * the saved meal in its authoritative shape, so we overwrite the optimistic
 * estimate in place (same id → no remount/re-fade) rather than waiting for a
 * day refetch. Any day fetch still in flight is cancelled BEFORE the write:
 * such a fetch read the PRE-save snapshot and would clobber the write when it
 * lands; the cancellations are AWAITED so an in-flight fetch can't resolve
 * between the cancel and the setQueriesData below.
 *
 * In-flight-entry heal: if a cached day-query entry's INITIAL fetch was still
 * running when we get here (data === undefined), the in-place write above isn't
 * enough to make the ring correct — that fetch never delivered the day's other
 * server meals, so the cache holds only what we just wrote:
 *   - daily-meals: onMutate never touches it, so an in-flight first load leaves
 *     it undefined and upsertMealIntoList no-ops → the ring stays empty. We
 *     detect the undefined entry here (getQueriesData) and refetch it.
 *   - logging-day: onMutate optimistically SEEDS it, which masks the in-flight
 *     first load — by the time we run, its entry is defined (holding only the
 *     optimistic/just-saved meal, undercounting any never-loaded server meals).
 *     The reliable signal is the onMutate snapshot (captured after the cancel,
 *     before the seed): a `undefined` there means the first load was in flight.
 * For each key flagged in-flight we invalidate with refetchType 'active' AFTER
 * the write. The pre-save fetch is already cancelled, so this refetch reads
 * post-save state and lands as the last writer. Keys whose entries all had data
 * keep the existing no-refetch fast path; unmounted surfaces (no cache entry)
 * stay handled by settleMealSave's stale marking — we never fabricate entries.
 */
export async function reconcileSavedMeal(
  queryClient: QueryClient,
  userId: string,
  originDate: string,
  savedMeal: PersistedMeal | undefined,
  analysisId?: string,
  /** onMutate's rollback snapshots (from applyOptimisticMeal), taken after the
   *  cancel but before the optimistic seed — a `undefined` logging-day entry
   *  here means its initial fetch was in flight and the seed now hides that. */
  onMutateSnapshots?: ReturnType<QueryClient['getQueriesData']>,
  /** applyOptimisticMeal's flag: our onMutate cancel killed a logging-day fetch
   *  that was in flight (initial load OR a prior save's heal refetch). When it
   *  was a prior heal, the snapshot above looks defined (the cancel reverted to
   *  that save's seed) yet the never-loaded server meals are still missing, so
   *  the post-write active refetch below must be re-armed regardless. */
  dayFetchCancelled?: boolean
) {
  const loggingDayKey = loggingDayKeys.byUserDate(userId, originDate);
  const dailyMealsKey = dailyMealsKeys.byDate(originDate);
  // Capture in-flight entries (initial fetch still running → data undefined)
  // BEFORE the cancels below abort them. daily-meals is unseeded so its live
  // entry is accurate; logging-day is masked by onMutate's seed, so consult the
  // pre-seed snapshot for it — or the dayFetchCancelled flag when the cancel
  // aborted a prior save's heal (which leaves the snapshot looking defined).
  const dailyMealsInFlight = queryClient
    .getQueriesData<PersistedMeal[]>({ queryKey: dailyMealsKey })
    .some(([, data]) => data === undefined);
  const loggingDayInFlight =
    queryClient
      .getQueriesData<LoggingDayData>({ queryKey: loggingDayKey })
      .some(([, data]) => data === undefined) ||
    (onMutateSnapshots?.some(([, data]) => data === undefined) ?? false) ||
    (dayFetchCancelled ?? false);
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
  // Heal the surfaces whose initial fetch we cancelled mid-flight: the in-place
  // write above can't hold the day's never-loaded server meals. The pre-save
  // fetch is cancelled, so this active refetch is the last writer.
  if (loggingDayInFlight) {
    queryClient.invalidateQueries({
      queryKey: loggingDayKey,
      refetchType: 'active',
    });
  }
  if (dailyMealsInFlight) {
    queryClient.invalidateQueries({
      queryKey: dailyMealsKey,
      refetchType: 'active',
    });
  }
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
