// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkDayComplete } from '@/hooks/meals/mutations/use-mark-day-complete';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import { nutritionKeys } from '@/lib/domain/nutrition/query-keys';
import { DATE, makeWrapper, USER_ID } from './fixtures';

const { mockMarkDayComplete, mockToastError } = vi.hoisted(() => ({
  mockMarkDayComplete: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/lib/actions/meals/day/mark-day-complete', () => ({
  markDayCompleteAction: mockMarkDayComplete,
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

function renderMark(queryClient: QueryClient) {
  return renderHook(() => useMarkDayComplete(USER_ID, DATE), {
    wrapper: makeWrapper(queryClient),
  });
}

describe('useMarkDayComplete', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
  });

  it('sends the day and the caller’s own timezone offset', async () => {
    mockMarkDayComplete.mockResolvedValue({
      success: true,
      markedComplete: true,
    });
    const { result } = renderMark(queryClient);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMarkDayComplete).toHaveBeenCalledWith({
      date: DATE,
      timezoneOffset: new Date().getTimezoneOffset(),
    });
  });

  it('invalidates every surface that reads day completeness', async () => {
    mockMarkDayComplete.mockResolvedValue({
      success: true,
      markedComplete: true,
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderMark(queryClient);

    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    // The day itself — as the 3-element PREFIX, so prefix matching reaches the
    // tz-suffixed key the query is really registered under.
    expect(keys).toContainEqual(loggingDayKeys.byUserDate(USER_ID, DATE));
    expect(keys).toContainEqual(dailyMealsKeys.byDate(DATE));
    // The trend surfaces: without these the heatmap keeps the day set aside.
    expect(keys).toContainEqual(nutritionKeys.all);
    expect(keys).toContainEqual(['dashboard']);
  });

  it('does not touch the cache optimistically before the server answers', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    mockMarkDayComplete.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      })
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderMark(queryClient);

    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    // The mark is one-way, so nothing may claim it until the write lands.
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      resolve?.({ success: true, markedComplete: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalled();
  });

  it('surfaces a toast and leaves the day untouched when the write fails', async () => {
    mockMarkDayComplete.mockRejectedValue(new Error('nope'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderMark(queryClient);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith('markError');
    expect(invalidate).not.toHaveBeenCalled();
  });
});
