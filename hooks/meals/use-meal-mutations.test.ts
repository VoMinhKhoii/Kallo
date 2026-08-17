// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyMealsKeys } from '@/hooks/meals/use-daily-meals';
import { loggingDayKeys } from '@/hooks/meals/use-logging-day';
import {
  useConfirmMeal,
  useDeleteMeal,
  useSaveManualMeal,
} from '@/hooks/meals/use-meal-mutations';
import { deleteMealAction } from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { ParsedMeal } from '@/lib/core/types/meal';
import type { CompleteManualMealRow } from '@/lib/domain/logging/manual-logging';

const { mockConfirm, mockSaveManual } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  mockSaveManual: vi.fn(),
}));

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction: mockConfirm,
}));

vi.mock('@/lib/actions/meals/mutate-meal', () => ({
  deleteMealAction: vi.fn(),
}));

vi.mock('@/lib/actions/logging/manual-meals', () => ({
  saveManualMealAction: mockSaveManual,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const USER_ID = 'user-123';
const DATE = '2026-05-29';
const TZ = new Date().getTimezoneOffset();
// The active query keys on its tz offset; the mutation invalidates/updates with
// the 3-element key and relies on prefix matching. Mirror that here.
const DAY_KEY = loggingDayKeys.byUserDateOffset(USER_ID, DATE, TZ);

function makeParsedMeal(): ParsedMeal {
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
function savedMealResult(
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

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function renderConfirm(queryClient: QueryClient) {
  return renderHook(() => useConfirmMeal(USER_ID), {
    wrapper: makeWrapper(queryClient),
  });
}

function dayData(client: QueryClient): LoggingDayData | undefined {
  return client.getQueryData<LoggingDayData>(DAY_KEY);
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

// ---------------------------------------------------------------------------
// useSaveManualMeal — manual (Cronometer-style) save, no pending analysis
// ---------------------------------------------------------------------------

function makeManualRows(): CompleteManualMealRow[] {
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

function manualVariables() {
  return {
    mealId: 'meal-manual-1',
    originDate: DATE,
    loggedDate: DATE,
    timezoneOffset: TZ,
    rows: makeManualRows(),
  };
}

function renderSaveManual(queryClient: QueryClient) {
  return renderHook(() => useSaveManualMeal(USER_ID), {
    wrapper: makeWrapper(queryClient),
  });
}

describe('useSaveManualMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('optimistically inserts the meal with client-computed macros, then reconciles in place', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });

    // Hold the server response to inspect the optimistic insert first.
    let release: (value: unknown) => void = () => {};
    mockSaveManual.mockImplementation(
      () => new Promise((resolve) => (release = resolve))
    );

    const { result } = renderSaveManual(queryClient);
    let mutation: Promise<unknown> = Promise.resolve();
    act(() => {
      mutation = result.current.mutateAsync(manualVariables());
    });

    await waitFor(() => {
      expect(dayData(queryClient)?.persistedMeals).toHaveLength(1);
    });
    const optimistic = dayData(queryClient)?.persistedMeals[0];
    expect(optimistic?.id).toBe('meal-manual-1');
    // 150g × 130 kcal/100g — computed client-side from the row's per-100g data.
    expect(optimistic?.nutrition.caloriesKcal).toBeCloseTo(195);
    expect(optimistic?.rawInput).toBe('150g cơm nhà nấu');
    expect(optimistic?.entryMode).toBe('precise');

    // Server resolves with the authoritative meal (same id, micros filled in).
    release(savedMealResult({ id: 'meal-manual-1', calories: 196 }));
    await mutation;

    const meals = dayData(queryClient)?.persistedMeals ?? [];
    expect(meals).toHaveLength(1);
    expect(meals[0]?.nutrition.caloriesKcal).toBe(196);

    // The server call carries only the API input — no optimistic-only fields.
    // The user's raw text rides along as the saved label.
    expect(mockSaveManual).toHaveBeenCalledWith({
      mealId: 'meal-manual-1',
      items: [
        { foodCompositionId: 'fct-rice', grams: 150, label: 'cơm nhà nấu' },
      ],
      mealSlot: undefined,
      loggedDate: DATE,
      timezoneOffset: TZ,
    });
  });

  it('rolls back the optimistic insert when the server rejects', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    mockSaveManual.mockRejectedValue(new Error('boom'));

    const { result } = renderSaveManual(queryClient);
    await expect(result.current.mutateAsync(manualVariables())).rejects.toThrow(
      'boom'
    );

    expect(dayData(queryClient)?.persistedMeals).toHaveLength(0);
  });

  it('leaves pending confirmations untouched (manual saves have none)', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [
        {
          id: 'pending-other',
          rawInput: 'bún chả',
          loggedAt: '2026-05-29T02:00:00.000Z',
        },
      ],
    });
    mockSaveManual.mockResolvedValue(savedMealResult({ id: 'meal-manual-1' }));

    const { result } = renderSaveManual(queryClient);
    await result.current.mutateAsync(manualVariables());

    expect(dayData(queryClient)?.pendingConfirmations).toHaveLength(1);
    expect(dayData(queryClient)?.persistedMeals).toHaveLength(1);
  });

  it('marks day queries stale without an eager refetch on success', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockSaveManual.mockResolvedValue(savedMealResult({ id: 'meal-manual-1' }));

    const { result } = renderSaveManual(queryClient);
    await result.current.mutateAsync(manualVariables());

    const dayInvalidation = invalidateSpy.mock.calls.find(
      (call) =>
        JSON.stringify(call[0]?.queryKey) ===
        JSON.stringify(loggingDayKeys.byUserDate(USER_ID, DATE))
    );
    expect(dayInvalidation?.[0]?.refetchType).toBe('none');
    const mealDatesInvalidation = invalidateSpy.mock.calls.find(
      (call) => JSON.stringify(call[0]?.queryKey) === '["meal-dates"]'
    );
    expect(mealDatesInvalidation).toBeDefined();
  });
});

function renderDelete(queryClient: QueryClient, date = DATE) {
  return renderHook(() => useDeleteMeal(USER_ID, date), {
    wrapper: makeWrapper(queryClient),
  });
}

describe('useDeleteMeal', () => {
  beforeEach(() => {
    vi.mocked(deleteMealAction).mockReset();
  });

  it('cancels then invalidates BOTH day queries + meal-dates on settle, scoped by the passed originDate (not today)', async () => {
    // The delete undo lives on the dashboard, but the meal must also drop from
    // the logging-day cache — else it lingers on the logging page after undo.
    // And the keys must use the passed originDate: a self-computed "today" drifts
    // from the save's originDate across a midnight rollover. DATE is a fixed past
    // day, so at HEAD (which keys off today) these DATE-scoped assertions fail.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [savedMealResult({ id: 'meal-1' }).meal],
      pendingConfirmations: [],
    });
    queryClient.setQueryData<PersistedMeal[]>(dailyMealsKeys.byDate(DATE), [
      savedMealResult({ id: 'meal-1' }).meal,
    ]);
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderDelete(queryClient);
    await result.current.mutateAsync({ mealId: 'meal-1' });

    await waitFor(() => {
      const cancelKeys = cancelSpy.mock.calls.map((call) => call[0]?.queryKey);
      const invalidateKeys = invalidateSpy.mock.calls.map(
        (call) => call[0]?.queryKey
      );
      expect(cancelKeys).toContainEqual(
        loggingDayKeys.byUserDate(USER_ID, DATE)
      );
      expect(cancelKeys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(invalidateKeys).toContainEqual(
        loggingDayKeys.byUserDate(USER_ID, DATE)
      );
      expect(invalidateKeys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(invalidateKeys).toContainEqual(['meal-dates']);
    });
  });

  it('optimistically removes the meal from the logging-day cache', async () => {
    // At HEAD onMutate only touches the dashboard daily-meals key, so the
    // logging-day cache keeps the deleted meal until a refetch. Hold the delete
    // unresolved to observe the optimistic (pre-settle) cache.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [
        savedMealResult({ id: 'meal-1' }).meal,
        savedMealResult({ id: 'meal-2' }).meal,
      ],
      pendingConfirmations: [],
    });
    let resolveDelete!: () => void;
    vi.mocked(deleteMealAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = () => resolve({ success: true });
        })
    );

    const { result } = renderDelete(queryClient);
    act(() => {
      result.current.mutate({ mealId: 'meal-1' });
    });

    await waitFor(() => {
      const meals = dayData(queryClient)?.persistedMeals ?? [];
      expect(meals.map((meal) => meal.id)).toEqual(['meal-2']);
    });
    act(() => resolveDelete());
  });

  it('actively refetches the logging-day surface when the delete fails', async () => {
    // onMutate cancelled any in-flight day fetch; on failure the rollback can
    // only restore the pre-cancel snapshot (undefined for an initial load that
    // never landed), so a mounted logging ring stays stale unless onSettled
    // refetches on error — mirror settleMealSave's error-keyed refetchType.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [savedMealResult({ id: 'meal-1' }).meal],
      pendingConfirmations: [],
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(deleteMealAction).mockRejectedValue(new Error('boom'));

    const { result } = renderDelete(queryClient);
    await result.current
      .mutateAsync({ mealId: 'meal-1' })
      .catch(() => undefined);

    await waitFor(() => {
      const loggingDayRefetch = invalidateSpy.mock.calls.find(
        (call) =>
          JSON.stringify(call[0]?.queryKey) ===
            JSON.stringify(loggingDayKeys.byUserDate(USER_ID, DATE)) &&
          call[0]?.refetchType === 'active'
      );
      expect(loggingDayRefetch).toBeDefined();
    });
  });
});
