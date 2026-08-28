// @vitest-environment jsdom
// The badge poll is the client's only liveness signal, so it owns one piece of
// coordination beyond returning a number: the activity watermark. When it
// moves, something landed — a new aggregate, or a refresh that re-surfaced an
// existing one above the reader's cursor without changing the count — and the
// feed (which never polls) has to be told. What is pinned here is exactly that
// edge — baseline on first load, invalidate whenever the watermark changes,
// silence when it holds even if the count moves.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockFetchBadge } = vi.hoisted(() => ({ mockFetchBadge: vi.fn() }));

vi.mock('@/lib/domain/notifications/client', () => ({
  fetchNotificationBadge: mockFetchBadge,
}));

import { useNotificationBadge } from '@/hooks/notifications/use-notification-badge';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';

const T1 = '2026-08-28T10:00:00.000Z';
const T2 = '2026-08-28T10:05:00.000Z';

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueries = vi
    .spyOn(client, 'invalidateQueries')
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useNotificationBadge(), { wrapper });
  return { result, invalidateQueries };
}

describe('useNotificationBadge', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('treats the first poll as a baseline, not a change', async () => {
    mockFetchBadge.mockResolvedValue({ unseen: 3, latestActivityAt: T1 });
    const { result, invalidateQueries } = setup();

    await waitFor(() => expect(result.current.data?.unseen).toBe(3));

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('baselines an empty inbox without invalidating', async () => {
    mockFetchBadge.mockResolvedValue({ unseen: 0, latestActivityAt: null });
    const { result, invalidateQueries } = setup();

    await waitFor(() =>
      expect(result.current.data?.latestActivityAt).toBeNull()
    );

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidates the feed when the watermark moves', async () => {
    mockFetchBadge
      .mockResolvedValueOnce({ unseen: 1, latestActivityAt: T1 })
      .mockResolvedValueOnce({ unseen: 3, latestActivityAt: T2 });
    const { result, invalidateQueries } = setup();
    await waitFor(() => expect(result.current.data?.unseen).toBe(1));

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data?.unseen).toBe(3));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: notificationKeys.feed,
    });
  });

  // The case a count-increase rule misses: a silent refresh of a row that was
  // already unseen re-surfaces it above the reader's cursor while the count
  // stands still. The watermark is what makes it visible.
  it('invalidates on a re-surfacing refresh that leaves the count unchanged', async () => {
    mockFetchBadge
      .mockResolvedValueOnce({ unseen: 2, latestActivityAt: T1 })
      .mockResolvedValueOnce({ unseen: 2, latestActivityAt: T2 });
    const { result, invalidateQueries } = setup();
    await waitFor(() => expect(result.current.data?.latestActivityAt).toBe(T1));

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data?.latestActivityAt).toBe(T2));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: notificationKeys.feed,
    });
  });

  it('leaves the feed alone while the watermark holds', async () => {
    mockFetchBadge
      .mockResolvedValueOnce({ unseen: 2, latestActivityAt: T1 })
      .mockResolvedValueOnce({ unseen: 2, latestActivityAt: T1 })
      // Opening Activity drops the count to zero without any new activity.
      .mockResolvedValueOnce({ unseen: 0, latestActivityAt: T1 });
    const { result, invalidateQueries } = setup();
    await waitFor(() => expect(result.current.data?.unseen).toBe(2));

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data?.unseen).toBe(2));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data?.unseen).toBe(0));

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
