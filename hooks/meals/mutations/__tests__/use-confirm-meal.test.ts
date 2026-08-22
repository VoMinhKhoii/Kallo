// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmMeal } from '@/hooks/meals/mutations/use-confirm-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import {
  DATE,
  DAY_KEY,
  dayData,
  makeParsedMeal,
  makeWrapper,
  savedMealResult,
  USER_ID,
} from './fixtures';

const { mockConfirm } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
}));

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction: mockConfirm,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderConfirm(queryClient: QueryClient) {
  return renderHook(() => useConfirmMeal(USER_ID), {
    wrapper: makeWrapper(queryClient),
  });
}

describe('useConfirmMeal optimistic update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts the meal into an empty day even when no pending row is cached', async () => {
    // The pre-save snapshot for the first meal of the day: an empty day. The
    // old code looked the pending row up here, found nothing, and silently
    // no-opped — leaving the calorie ring stuck.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    mockConfirm.mockResolvedValue(savedMealResult({ calories: 450 }));

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
    });

    const meals = dayData(queryClient)?.persistedMeals ?? [];
    expect(meals).toHaveLength(1);
    expect(meals[0]?.id).toBe('meal-1');
    expect(meals[0]?.nutrition.caloriesKcal).toBe(450);
    // The server input must not carry the optimistic-only fields.
    expect(mockConfirm).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
    });
  });

  it('reflects quantity edits in the optimistic nutrition totals (pre-reconcile)', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    // Hold the server response so we can inspect the OPTIMISTIC insert before
    // onSuccess overwrites it with authoritative values.
    // Definite-assignment (!): the Promise executor runs synchronously, so this
    // is assigned before any use, but TS control-flow can't prove it.
    let resolveConfirm!: (value: ReturnType<typeof savedMealResult>) => void;
    mockConfirm.mockReturnValue(
      new Promise((resolve) => {
        resolveConfirm = resolve;
      })
    );

    const { result } = renderConfirm(queryClient);
    act(() => {
      result.current.mutate({
        analysisId: 'analysis-1',
        mealId: 'meal-1',
        originDate: DATE,
        parsedMeal: makeParsedMeal(),
        rawInput: 'Phở bò',
        loggedAt: '2026-05-29T01:00:00.000Z',
        // Whole-dish edit: double the 300g portion to 600g.
        edits: [{ mealItemOrder: 0, newGrams: 600 }],
      });
    });

    await waitFor(() => {
      const meals = dayData(queryClient)?.persistedMeals ?? [];
      expect(meals[0]?.nutrition.caloriesKcal).toBe(900);
      expect(meals[0]?.nutrition.proteinG).toBe(60);
    });

    // Let the mutation settle so the hook doesn't leak a pending promise.
    await act(async () => {
      resolveConfirm(savedMealResult({ calories: 900, protein: 60 }));
    });
  });

  it('removes the matching pending confirmation while keeping existing meals', async () => {
    const queryClient = new QueryClient();
    const existing = {
      id: 'meal-0',
      rawInput: 'Cơm tấm',
      mealSlot: null,
      confidenceOverall: null,
      loggedAt: '2026-05-29T00:00:00.000Z',
      nutrition: { caloriesKcal: 600 },
      mealItemGroups: [],
    } as unknown as LoggingDayData['persistedMeals'][number];
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [existing],
      pendingConfirmations: [
        {
          id: 'analysis-1',
          rawInput: 'Phở bò',
          loggedAt: '2026-05-29T01:00:00.000Z',
          parsedMeal: makeParsedMeal(),
        } as unknown as LoggingDayData['pendingConfirmations'][number],
      ],
    });
    mockConfirm.mockResolvedValue(savedMealResult());

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
    });

    const day = dayData(queryClient);
    expect(day?.persistedMeals.map((m) => m.id)).toEqual(['meal-0', 'meal-1']);
    expect(day?.pendingConfirmations).toHaveLength(0);
  });

  it('rolls back to the pre-mutation snapshot when the server rejects', async () => {
    const queryClient = new QueryClient();
    const snapshot: LoggingDayData = {
      persistedMeals: [],
      pendingConfirmations: [],
    };
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, snapshot);
    mockConfirm.mockRejectedValue(new Error('boom'));

    const { result } = renderConfirm(queryClient);
    await expect(
      result.current.mutateAsync({
        analysisId: 'analysis-1',
        mealId: 'meal-1',
        originDate: DATE,
        parsedMeal: makeParsedMeal(),
        rawInput: 'Phở bò',
        loggedAt: '2026-05-29T01:00:00.000Z',
      })
    ).rejects.toThrow('boom');

    expect(dayData(queryClient)?.persistedMeals).toHaveLength(0);
  });

  it('cancels then invalidates the day + daily-meals + meal-dates on settle', async () => {
    // The day queries must be cancelled first (to drop any in-flight pre-commit
    // fetch) THEN invalidated, so the refetch is fresh post-commit state rather
    // than a dedupe into the empty fetch. Invalidate (not refetch-active-only)
    // so the usually-unmounted dashboard daily-meals query is marked stale and
    // refreshes when next shown.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockConfirm.mockResolvedValue(savedMealResult());

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
    });

    await waitFor(() => {
      const cancelKeys = cancelSpy.mock.calls.map((call) => call[0]?.queryKey);
      const invalidateKeys = invalidateSpy.mock.calls.map(
        (call) => call[0]?.queryKey
      );
      expect(cancelKeys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(cancelKeys).toContainEqual(
        loggingDayKeys.byUserDate(USER_ID, DATE)
      );
      expect(invalidateKeys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(invalidateKeys).toContainEqual(
        loggingDayKeys.byUserDate(USER_ID, DATE)
      );
      expect(invalidateKeys).toContainEqual(['meal-dates']);
    });
  });

  it('re-asserts the confirmed meal if a stale empty read clobbers the cache mid-save', async () => {
    // Regression (first meal of the day): a window-focus/stale day fetch that
    // captured the pre-save empty snapshot can resolve during the save and reset
    // the cache, leaving the calorie ring at zero until a manual refresh. The
    // onSuccess re-assert must reinstate the confirmed meal after such a clobber.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    // The server call resolves, but a stale read overwrites the optimistic
    // insert with the empty pre-save snapshot just before success.
    mockConfirm.mockImplementation(async () => {
      queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
        persistedMeals: [],
        pendingConfirmations: [],
      });
      return savedMealResult();
    });

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
    });

    const meals = dayData(queryClient)?.persistedMeals ?? [];
    expect(meals).toHaveLength(1);
    expect(meals[0]?.id).toBe('meal-1');
  });

  it('falls back to an active refetch when the response omits the saved meal', async () => {
    // Defensive contract-skew path: if the confirm response lacks `meal`, the
    // in-place reconcile is impossible, so onSuccess must invalidate the day
    // queries with an ACTIVE refetch (default refetchType) to heal — distinct
    // from the refetchType:'none' marks onSettled issues on the normal path.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockConfirm.mockResolvedValue({ mealId: 'meal-1' }); // no `meal`

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
    });

    const activeDayInvalidations = invalidateSpy.mock.calls.filter(
      (call) =>
        JSON.stringify(call[0]?.queryKey) ===
          JSON.stringify(loggingDayKeys.byUserDate(USER_ID, DATE)) &&
        call[0]?.refetchType === undefined
    );
    expect(activeDayInvalidations.length).toBeGreaterThan(0);
  });

  it('re-arms the daily-meals heal when a save races a refetch over DEFINED-but-stale data', async () => {
    // The `data === undefined` in-flight check catches an initial load, but not
    // a refetch running over already-cached (stale) daily-meals — e.g. a
    // focus/staleTime refetch, or a prior save's heal about to land fuller
    // server state. reconcile's cancel kills that refetch; upserting only the
    // saved meal onto the stale list drops whatever the refetch would have
    // surfaced. The fetch-status signal must re-arm an active refetch so the
    // ring heals to authoritative state instead of the stale list + one meal.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    const dailyKey = dailyMealsKeys.byDate(DATE);
    // Defined (stale) data present, then a refetch left in flight over it.
    queryClient.setQueryData<PersistedMeal[]>(dailyKey, [
      savedMealResult({ id: 'meal-existing' }).meal,
    ]);
    queryClient
      .fetchQuery({
        queryKey: dailyKey,
        queryFn: () => new Promise<PersistedMeal[]>(() => {}),
      })
      .catch(() => {});
    await waitFor(() =>
      expect(queryClient.getQueryState(dailyKey)?.fetchStatus).toBe('fetching')
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockConfirm.mockResolvedValue(savedMealResult());

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
    });

    const dailyActiveRearm = invalidateSpy.mock.calls.find(
      (call) =>
        JSON.stringify(call[0]?.queryKey) === JSON.stringify(dailyKey) &&
        call[0]?.refetchType === 'active'
    );
    expect(dailyActiveRearm).toBeDefined();
  });
});
