// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyMealsKeys } from '@/hooks/use-daily-meals';
import { loggingDayKeys } from '@/hooks/use-logging-day';
import { useConfirmMeal } from '@/hooks/use-meal-mutations';
import type { LoggingDayData } from '@/lib/actions/meals';
import type { ParsedMeal } from '@/lib/types/meal';

const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));

vi.mock('@/lib/actions/meals', () => ({
  confirmAndSaveMealAction: mockConfirm,
  deleteMealAction: vi.fn(),
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
    mockConfirm.mockResolvedValue({ mealId: 'meal-1' });

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

  it('reflects quantity edits in the optimistic nutrition totals', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    mockConfirm.mockResolvedValue({ mealId: 'meal-1' });

    const { result } = renderConfirm(queryClient);
    await result.current.mutateAsync({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
      originDate: DATE,
      parsedMeal: makeParsedMeal(),
      rawInput: 'Phở bò',
      loggedAt: '2026-05-29T01:00:00.000Z',
      // Whole-dish edit: double the 300g portion to 600g.
      edits: [{ mealItemOrder: 0, newGrams: 600 }],
    });

    const meals = dayData(queryClient)?.persistedMeals ?? [];
    expect(meals[0]?.nutrition.caloriesKcal).toBe(900);
    expect(meals[0]?.nutrition.proteinG).toBe(60);
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
    mockConfirm.mockResolvedValue({ mealId: 'meal-1' });

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

  it('cancels then refetches the day + daily-meals and invalidates meal-dates on settle', async () => {
    // The day queries must be cancelled (to drop any in-flight pre-commit fetch)
    // then refetched as the last writer — a plain invalidate would dedupe into
    // that empty fetch. meal-dates has no such race and stays a plain invalidate.
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockConfirm.mockResolvedValue({ mealId: 'meal-1' });

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
      const refetchKeys = refetchSpy.mock.calls.map((call) => call[0]?.queryKey);
      const invalidateKeys = invalidateSpy.mock.calls.map(
        (call) => call[0]?.queryKey
      );
      expect(cancelKeys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(cancelKeys).toContainEqual(loggingDayKeys.byUserDate(USER_ID, DATE));
      expect(refetchKeys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(refetchKeys).toContainEqual(
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
      return { mealId: 'meal-1' };
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
});
