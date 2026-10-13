// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiscardPending } from '@/hooks/meals/mutations/use-discard-pending';
import { discardPendingAnalysisAction } from '@/lib/actions/meals/mutate-meal';
import type {
  LoggingDayData,
  PendingMealConfirmation,
} from '@/lib/actions/meals/types';
import type { ChatMessage } from '@/lib/core/types/meal';
import { mealShareInvitesKeys } from '@/lib/domain/social/query-keys';
import { DATE, DAY_KEY, dayData, makeWrapper, USER_ID } from './fixtures';

vi.mock('@/lib/actions/meals/mutate-meal', () => ({
  discardPendingAnalysisAction: vi.fn(),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

type ToastOptions = {
  action: { onClick: () => void };
  onAutoClose: () => Promise<void>;
  onDismiss: () => Promise<void>;
};
const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() })
);
vi.mock('sonner', () => ({ toast: toastMock }));

const ANALYSIS_ID = '11111111-1111-4111-8111-111111111111';
const MESSAGE = {
  id: 'msg-1',
  role: 'assistant',
  content: '',
  timestamp: new Date('2026-05-29T08:00:00Z'),
  loggedDate: DATE,
  analysisId: ANALYSIS_ID,
} as ChatMessage;

function seedDay(queryClient: QueryClient) {
  queryClient.setQueryData<LoggingDayData>(DAY_KEY, {
    persistedMeals: [],
    pendingConfirmations: [
      { id: ANALYSIS_ID } as PendingMealConfirmation,
      { id: 'other' } as PendingMealConfirmation,
    ],
    markedComplete: false,
  });
}

function setup() {
  const queryClient = new QueryClient();
  seedDay(queryClient);
  const setMessages = vi.fn();
  const view = renderHook(
    () =>
      useDiscardPending({ userId: USER_ID, selectedDate: DATE, setMessages }),
    { wrapper: makeWrapper(queryClient) }
  );
  act(() => view.result.current.handleDiscardPending(MESSAGE));
  const options = toastMock.mock.calls.at(-1)?.[1] as ToastOptions;
  return { queryClient, setMessages, view, options };
}

describe('useDiscardPending', () => {
  beforeEach(() => {
    vi.mocked(discardPendingAnalysisAction).mockReset();
    toastMock.mockClear();
    toastMock.error.mockClear();
  });

  it('hides the card at once and deletes nothing until the toast closes', () => {
    const { view } = setup();
    expect(view.result.current.hiddenAnalysisIds.has(ANALYSIS_ID)).toBe(true);
    expect(discardPendingAnalysisAction).not.toHaveBeenCalled();
  });

  it('undo brings the card back and never calls the server', async () => {
    const { view, options } = setup();
    act(() => options.action.onClick());
    await act(() => options.onDismiss());
    expect(view.result.current.hiddenAnalysisIds.size).toBe(0);
    expect(discardPendingAnalysisAction).not.toHaveBeenCalled();
  });

  it('on close, deletes once and drops the card from the day cache and local list', async () => {
    vi.mocked(discardPendingAnalysisAction).mockResolvedValue({
      success: true,
    });
    const { queryClient, setMessages, options } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(() => options.onAutoClose());
    await act(() => options.onDismiss());

    expect(discardPendingAnalysisAction).toHaveBeenCalledTimes(1);
    expect(discardPendingAnalysisAction).toHaveBeenCalledWith({
      analysisId: ANALYSIS_ID,
    });
    expect(dayData(queryClient)?.pendingConfirmations.map((p) => p.id)).toEqual(
      ['other']
    );
    const drop = setMessages.mock.calls[0][0] as (
      prev: ChatMessage[]
    ) => ChatMessage[];
    expect(drop([MESSAGE])).toEqual([]);
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toContainEqual(
      mealShareInvitesKeys.all
    );
  });

  it('treats "not found" (expired or already saved) as gone, silently', async () => {
    vi.mocked(discardPendingAnalysisAction).mockResolvedValue({
      success: false,
      reason: 'not_found',
    });
    const { queryClient, view, options } = setup();
    await act(() => options.onAutoClose());
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(view.result.current.hiddenAnalysisIds.size).toBe(0);
    expect(dayData(queryClient)?.pendingConfirmations.map((p) => p.id)).toEqual(
      ['other']
    );
  });

  it('a real failure puts the card back and says so', async () => {
    // What production delivers for any thrown action error: a generic
    // message, never the server's own wording.
    vi.mocked(discardPendingAnalysisAction).mockRejectedValue(
      new Error('An error occurred in the Server Components render.')
    );
    const { queryClient, view, options } = setup();
    await act(() => options.onAutoClose());
    expect(toastMock.error).toHaveBeenCalledWith('discardError');
    expect(view.result.current.hiddenAnalysisIds.size).toBe(0);
    expect(dayData(queryClient)?.pendingConfirmations).toHaveLength(2);
  });
});
