// @vitest-environment jsdom
// The badge poll is the client's only liveness signal, so it owns one piece of
// coordination beyond returning a number: the activity watermark. When it
// moves, something landed — a new aggregate, or a refresh that re-surfaced an
// existing one above the reader's cursor without changing the count — and the
// feed (which never polls) has to be told. What is pinned here is exactly that
// edge — invalidate whenever the watermark changes, silence when it holds even
// if the count moves, and, on the FIRST observation (which has no previous
// value to compare with), invalidate only when the feed already in cache is
// older than the watermark.

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

const T0 = '2026-08-28T09:00:00.000Z';
const T1 = '2026-08-28T10:00:00.000Z';
const T2 = '2026-08-28T10:05:00.000Z';

/** A cached feed holding one row last touched at `updatedAt` — the shape
 *  `useInfiniteQuery` stores. Pass no timestamps for a cached-but-empty feed. */
function cachedFeed(...updatedAts: string[]) {
  return {
    pages: [
      {
        items: updatedAts.map((updatedAt, index) => ({
          id: `notification-${index}`,
          updatedAt,
        })),
        nextCursor: null,
        unseenCount: updatedAts.length,
      },
    ],
    pageParams: [undefined],
  };
}

function setup(feed?: ReturnType<typeof cachedFeed>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (feed) client.setQueryData(notificationKeys.feed, feed);
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

  // Mounting must not invalidate the fetch the page is in the middle of, and
  // with no cached feed there is nothing stale to heal either way.
  it('baselines the first poll when no feed is cached', async () => {
    mockFetchBadge.mockResolvedValue({ unseen: 3, latestActivityAt: T1 });
    const { result, invalidateQueries } = setup();

    await waitFor(() => expect(result.current.data?.unseen).toBe(3));

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  // The lost wakeup a plain baseline would swallow: the feed GET completes, an
  // event commits, and the FIRST badge poll already carries the moved
  // watermark. With nothing to compare it against, the page would sit on a
  // known-stale feed until some later, unrelated activity moved the watermark
  // again. Comparing against the cache is what closes that window.
  it('heals a cached feed that is already older than the first watermark', async () => {
    mockFetchBadge.mockResolvedValue({ unseen: 1, latestActivityAt: T2 });
    const { result, invalidateQueries } = setup(cachedFeed(T1, T0));

    await waitFor(() => expect(result.current.data?.unseen).toBe(1));

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: notificationKeys.feed,
    });
  });

  it('leaves a cached feed as fresh as the first watermark alone', async () => {
    mockFetchBadge.mockResolvedValue({ unseen: 1, latestActivityAt: T1 });
    const { result, invalidateQueries } = setup(cachedFeed(T1, T0));

    await waitFor(() => expect(result.current.data?.unseen).toBe(1));

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
