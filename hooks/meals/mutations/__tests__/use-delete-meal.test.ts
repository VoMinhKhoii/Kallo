// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeleteMeal } from '@/hooks/meals/mutations/use-delete-meal';
import { deleteMealAction } from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import {
  DATE,
  DAY_KEY,
  dayData,
  makeWrapper,
  savedMealResult,
  USER_ID,
} from './fixtures';

vi.mock('@/lib/actions/meals/mutate-meal', () => ({
  deleteMealAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

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
