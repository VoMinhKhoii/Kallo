// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateMeal } from '@/hooks/meals/mutations/use-update-meal';
import { updateMealAction } from '@/lib/actions/meals/mutate-meal';
import { DATE, makeWrapper, savedMealResult, USER_ID } from './fixtures';

vi.mock('@/lib/actions/meals/mutate-meal', () => ({
  updateMealAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('useUpdateMeal', () => {
  beforeEach(() => {
    vi.mocked(updateMealAction).mockReset();
  });

  it('invalidates meal-dates on settle so the sidebar total is not left stale', async () => {
    // An edit recomputes meals.calories_kcal server-side, and the timeline's
    // per-day total is derived from the ['meal-dates'] cache. Without this the
    // card shows the new calories while the sidebar still shows the old ones
    // until some unrelated refetch happens. The save and delete paths already
    // invalidate it; this one did not, because before the totals existed a
    // gram edit could not change which DATES exist.
    vi.mocked(updateMealAction).mockResolvedValue(
      savedMealResult({ id: 'meal-1' })
    );
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateMeal(USER_ID, DATE), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        mealId: 'meal-1',
        edits: [{ id: 'row-1', newGrams: 150 }],
        removeIds: [],
      });
    });

    await waitFor(() => {
      const keys = invalidate.mock.calls.map((call) =>
        JSON.stringify(call[0]?.queryKey)
      );
      expect(keys).toContain(JSON.stringify(['meal-dates']));
    });
  });
});
