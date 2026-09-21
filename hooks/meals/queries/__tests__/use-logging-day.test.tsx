// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoggingDay } from '@/hooks/meals/queries/use-logging-day';
import { loadLoggingDay } from '@/lib/actions/meals/load-meals';
import type { LoggingDayData } from '@/lib/actions/meals/types';
import { mealShareInvitesKeys } from '@/lib/domain/social/query-keys';

// Loading a day sweeps the user's week-abandoned staging cards, and a card
// staged from a friend's cheat offer hands that offer back when it goes. The
// offer returns server-side as a side effect of a READ, so if this hook does
// not act on the signal nothing else will: the inbox query is watched
// continuously by the nav badge, so it never goes stale on its own and keeps
// serving the empty list it cached before the offer came back.

vi.mock('@/lib/actions/meals/load-meals', () => ({
  loadLoggingDay: vi.fn(),
}));

const USER_ID = 'user-1';
const DATE = '2026-04-06';

function emptyDay(overrides: Partial<LoggingDayData> = {}): LoggingDayData {
  return {
    persistedMeals: [],
    pendingConfirmations: [],
    markedComplete: false,
    ...overrides,
  };
}

function renderDay(queryClient: QueryClient) {
  return renderHook(() => useLoggingDay(USER_ID, DATE), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
}

describe('useLoggingDay', () => {
  beforeEach(() => {
    vi.mocked(loadLoggingDay).mockReset();
  });

  it('refreshes the invite inbox when the day load handed an offer back', async () => {
    vi.mocked(loadLoggingDay).mockResolvedValue(
      emptyDay({ releasedInvites: true })
    );
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderDay(queryClient);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: mealShareInvitesKeys.all,
    });
  });

  it('leaves the inbox alone on an ordinary day load', async () => {
    // The overwhelmingly common case. Invalidating unconditionally would spend
    // a request on the inbox every time anyone opens a day.
    vi.mocked(loadLoggingDay).mockResolvedValue(emptyDay());
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderDay(queryClient);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: mealShareInvitesKeys.all,
    });
  });

  it('still returns the day it was asked for', async () => {
    // The invalidation is a side effect of the fetch, not a replacement for it.
    vi.mocked(loadLoggingDay).mockResolvedValue(
      emptyDay({ markedComplete: true, releasedInvites: true })
    );
    const queryClient = new QueryClient();

    const { result } = renderDay(queryClient);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.markedComplete).toBe(true);
  });
});
