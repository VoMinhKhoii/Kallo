// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFeedInvalidation } from '@/hooks/meals/feed/use-feed-invalidation';

const USER_ID = 'user-1';
const DATE = '2026-05-04';

function makeSpiedClient() {
  const client = new QueryClient();
  const order: string[] = [];
  const cancelQueries = vi
    .spyOn(client, 'cancelQueries')
    .mockImplementation((filters?: { queryKey?: unknown }) => {
      order.push(`cancel:${JSON.stringify(filters?.queryKey)}`);
      return Promise.resolve();
    });
  const invalidateQueries = vi
    .spyOn(client, 'invalidateQueries')
    .mockImplementation((filters?: { queryKey?: unknown }) => {
      order.push(`invalidate:${JSON.stringify(filters?.queryKey)}`);
      return Promise.resolve();
    });
  return { client, order, cancelQueries, invalidateQueries };
}

describe('useFeedInvalidation.handleBarcodeSuccess', () => {
  it('cancels both day queries first, then invalidates both plus meal-dates', async () => {
    const { client, order, cancelQueries, invalidateQueries } =
      makeSpiedClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useFeedInvalidation({
          userId: USER_ID,
          selectedDate: DATE,
          messages: [],
          streamingMsgId: null,
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleBarcodeSuccess();
    });

    // Cancel BOTH day keys (guards a pre-save in-flight fetch from clobbering).
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: ['logging-day', USER_ID, DATE],
    });
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: ['daily-meals', DATE],
    });
    // Invalidate BOTH day keys (dashboard ring no longer lags) + meal-dates.
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['logging-day', USER_ID, DATE],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['daily-meals', DATE],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['meal-dates'],
    });

    // Every cancel precedes every invalidate.
    const lastCancel = order.reduce(
      (last, entry, i) => (entry.startsWith('cancel') ? i : last),
      -1
    );
    const firstInvalidate = order.findIndex((entry) =>
      entry.startsWith('invalidate')
    );
    expect(lastCancel).toBeGreaterThanOrEqual(0);
    expect(lastCancel).toBeLessThan(firstInvalidate);
  });
});
