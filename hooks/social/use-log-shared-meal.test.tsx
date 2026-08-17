// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockLogSharedMeal } = vi.hoisted(() => ({
  mockLogSharedMeal: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/domain/social/circle-client', () => ({
  logSharedMeal: mockLogSharedMeal,
}));

import { useLogSharedMeal } from '@/hooks/social/use-log-shared-meal';

describe('useLogSharedMeal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cancels then invalidates BOTH the logging-day and daily-meals caches on success', async () => {
    mockLogSharedMeal.mockResolvedValueOnce(undefined);
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
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
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLogSharedMeal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ shareId: 'share-1', factor: 1 });
    });

    // The dashboard ring still reads daily-meals, so it must be refreshed too —
    // not just the logging-day query.
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['logging-day'] });
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['daily-meals'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['logging-day'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['daily-meals'],
    });

    // Cancels precede invalidations.
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
