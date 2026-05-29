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

  it('invalidates the day, daily-meals, and meal-dates on settle', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
      persistedMeals: [],
      pendingConfirmations: [],
    });
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
      const keys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
      expect(keys).toContainEqual(dailyMealsKeys.byDate(DATE));
      expect(keys).toContainEqual(loggingDayKeys.byUserDate(USER_ID, DATE));
      expect(keys).toContainEqual(['meal-dates']);
    });
  });
});
