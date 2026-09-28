// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { mockBlockFriend, mockRemoveFriend } = vi.hoisted(() => ({
  mockBlockFriend: vi.fn(),
  mockRemoveFriend: vi.fn(),
}));

vi.mock('@/lib/domain/social/circle-client', () => ({
  blockFriend: mockBlockFriend,
  fetchFriends: vi.fn(),
  removeFriend: mockRemoveFriend,
}));

import {
  useBlockFriend,
  useRemoveFriend,
} from '@/hooks/social/circle/use-friends';

/** Render a friend mutation hook; `keys()` lists every query it invalidated. */
function renderMutation(
  useFriendMutation: () => { mutateAsync: (id: string) => Promise<unknown> }
) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidateQueries = vi
    .spyOn(client, 'invalidateQueries')
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useFriendMutation, { wrapper });
  return {
    mutate: () => result.current.mutateAsync('user-2'),
    keys: () =>
      invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
  };
}

describe('useBlockFriend', () => {
  it('refetches every cached surface that could still show the blocked person', async () => {
    mockBlockFriend.mockResolvedValueOnce({ status: 'blocked' });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateQueries = vi
      .spyOn(client, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useBlockFriend(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('user-2');
    });

    const invalidated = invalidateQueries.mock.calls.map(
      ([filters]) => filters?.queryKey
    );
    expect(invalidated).toEqual(
      expect.arrayContaining([
        ['friends'],
        ['circle-feed'],
        ['friends-thread-feed'],
        ['share-thread'],
        ['chat-groups'],
        ['notifications'],
        // Its latestSharedAt may be the blocked person's share.
        ['friends-feed-read-marker'],
      ])
    );
  });
});

describe('useRemoveFriend', () => {
  it("refreshes the unread marker, whose newest share may be the removed friend's", async () => {
    mockRemoveFriend.mockResolvedValueOnce(undefined);
    const hook = renderMutation(useRemoveFriend);

    await act(async () => {
      await hook.mutate();
    });

    expect(hook.keys()).toEqual(
      expect.arrayContaining([
        ['friends'],
        ['circle-feed'],
        ['friends-feed-read-marker'],
      ])
    );
  });
});
