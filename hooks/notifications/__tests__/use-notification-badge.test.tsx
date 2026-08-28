// @vitest-environment jsdom
// The badge poll is the client's only liveness signal, so it owns one piece of
// coordination beyond returning a number: a rise in the unseen count means
// something landed, and the feed (which never polls) has to be told. What is
// pinned here is exactly that edge — baseline on first load, invalidate on an
// increase, silence otherwise.

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

  it('treats the first count as a baseline, not an increase', async () => {
    mockFetchBadge.mockResolvedValue({ unseen: 3 });
    const { result, invalidateQueries } = setup();

    await waitFor(() => expect(result.current.data?.unseen).toBe(3));

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidates the feed when a later poll counts more unseen rows', async () => {
    mockFetchBadge
      .mockResolvedValueOnce({ unseen: 1 })
      .mockResolvedValueOnce({ unseen: 3 });
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

  it('leaves the feed alone when the count holds or falls', async () => {
    mockFetchBadge
      .mockResolvedValueOnce({ unseen: 2 })
      .mockResolvedValueOnce({ unseen: 2 })
      .mockResolvedValueOnce({ unseen: 0 });
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
