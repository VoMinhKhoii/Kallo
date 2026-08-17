import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockCreateShareReply } = vi.hoisted(() => ({
  mockCreateShareReply: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/social/circle-client', () => ({
  createShareReply: mockCreateShareReply,
}));

import { useCreateReply } from '@/hooks/social/use-create-reply';

const SHARE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const REPLY_ID_1 = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const REPLY_ID_2 = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function reply(id: string) {
  return {
    id,
    author: {
      userId: SHARE_ID,
      handle: 'pho-fan',
      displayName: null,
      avatarSeed: null,
      avatarUrl: null,
    },
    isSelf: true,
    body: 'Ngon quá',
    createdAt: '2026-07-18T00:00:00.000Z',
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 1, retryDelay: 0 },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCreateReply', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('reuses one generated id across transport retries', async () => {
    const randomUUID = vi.fn().mockReturnValue(REPLY_ID_1);
    vi.stubGlobal('crypto', { randomUUID });
    mockCreateShareReply
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(reply(REPLY_ID_1));
    const { result } = renderHook(() => useCreateReply(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        shareId: SHARE_ID,
        body: 'Ngon quá',
      });
    });

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(mockCreateShareReply).toHaveBeenNthCalledWith(1, {
      shareId: SHARE_ID,
      replyId: REPLY_ID_1,
      body: 'Ngon quá',
    });
    expect(mockCreateShareReply).toHaveBeenNthCalledWith(2, {
      shareId: SHARE_ID,
      replyId: REPLY_ID_1,
      body: 'Ngon quá',
    });
  });

  it('generates a fresh id for each mutate call', async () => {
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce(REPLY_ID_1)
      .mockReturnValueOnce(REPLY_ID_2);
    vi.stubGlobal('crypto', { randomUUID });
    mockCreateShareReply
      .mockResolvedValueOnce(reply(REPLY_ID_1))
      .mockResolvedValueOnce(reply(REPLY_ID_2));
    const { result } = renderHook(() => useCreateReply(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ shareId: SHARE_ID, body: 'Một' });
      await result.current.mutateAsync({ shareId: SHARE_ID, body: 'Hai' });
    });

    expect(
      mockCreateShareReply.mock.calls.map(([input]) => input.replyId)
    ).toEqual([REPLY_ID_1, REPLY_ID_2]);
  });

  it('keeps the optimistic cache bounded to the newest 12 replies', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => REPLY_ID_1 });
    mockCreateShareReply.mockResolvedValueOnce(reply(REPLY_ID_1));
    const client = new QueryClient();
    const queryKey = ['chat-groups', SHARE_ID, 'feed'];
    client.setQueryData(queryKey, {
      pages: [
        {
          entries: [
            {
              meal: { shareId: SHARE_ID },
              replies: Array.from({ length: 12 }, (_, index) =>
                reply(`reply-${index}`)
              ),
              repliesTotal: 20,
            },
          ],
        },
      ],
    });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateReply(), {
      wrapper: localWrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        shareId: SHARE_ID,
        body: 'Mới nhất',
      });
    });

    const cached = client.getQueryData<{
      pages: Array<{
        entries: Array<{ replies: unknown[]; repliesTotal: number }>;
      }>;
    }>(queryKey);
    expect(cached?.pages[0]?.entries[0]?.replies).toHaveLength(12);
    expect(cached?.pages[0]?.entries[0]?.repliesTotal).toBe(21);
  });
});
