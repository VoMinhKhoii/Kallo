// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { mockBlockFriend } = vi.hoisted(() => ({ mockBlockFriend: vi.fn() }));

vi.mock('@/lib/domain/social/circle-client', () => ({
  blockFriend: mockBlockFriend,
  fetchFriends: vi.fn(),
  removeFriend: vi.fn(),
}));

import { useBlockFriend } from '@/hooks/social/circle/use-friends';

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
      ])
    );
  });
});
