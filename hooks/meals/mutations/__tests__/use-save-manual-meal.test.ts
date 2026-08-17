// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveManualMeal } from '@/hooks/meals/mutations/use-save-manual-meal';
import type { LoggingDayData } from '@/lib/actions/meals/types';
import { loggingDayKeys } from '@/lib/domain/meals/query-keys';
import {
  DATE,
  DAY_KEY,
  dayData,
  makeManualRows,
  makeWrapper,
  savedMealResult,
  TZ,
  USER_ID,
} from './fixtures';

const { mockSaveManual } = vi.hoisted(() => ({
  mockSaveManual: vi.fn(),
}));

vi.mock('@/lib/actions/logging/manual-meals', () => ({
  saveManualMealAction: mockSaveManual,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---------------------------------------------------------------------------
// useSaveManualMeal — manual (Cronometer-style) save, no pending analysis
// ---------------------------------------------------------------------------

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
