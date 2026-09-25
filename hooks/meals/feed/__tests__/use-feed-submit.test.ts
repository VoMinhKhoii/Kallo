import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/core/types/meal';
import { useFeedSubmit } from '../use-feed-submit';

function useSubmitHarness(ensureAiConsent: () => Promise<boolean>) {
  const analyze = vi.fn().mockResolvedValue(undefined);
  const clear = vi.fn();
  const messages: ChatMessage[] = [];

  const { handleSubmit } = useFeedSubmit({
    stream: {
      status: 'idle',
      items: [],
      completedItems: [],
      result: null,
      cheatSpec: null,
      analysisId: null,
      error: null,
      isAnalyzing: false,
      analyze,
      reset: vi.fn(),
    },
    selectedDate: '2026-04-06',
    inputRef: {
      current: {
        getText: () => 'Phở bò',
        getManualRows: () => [],
        clear,
        focus: vi.fn(),
        setText: vi.fn(),
        getTextarea: () => null,
      },
    },
    setMessages: (updater) => {
      const next = typeof updater === 'function' ? updater(messages) : updater;
      messages.splice(0, messages.length, ...next);
    },
    setStreamingMsgId: vi.fn(),
    scrollToBottom: vi.fn(),
    guard: (fn) => fn(),
    lastAnalysisIdRef: { current: null },
    lastErrorRef: { current: null },
    ensureAiConsent,
  });

  return { analyze, clear, messages, handleSubmit };
}

describe('useFeedSubmit', () => {
  it('date-scopes optimistic messages and analysis requests', async () => {
    const { analyze, clear, messages, handleSubmit } = useSubmitHarness(
      async () => true
    );

    await handleSubmit();

    expect(clear).toHaveBeenCalled();
    expect(analyze).toHaveBeenCalledWith({
      message: 'Phở bò',
      loggedDate: '2026-04-06',
      timezoneOffset: expect.any(Number),
      attemptId: expect.any(String),
    });
    expect(messages).toHaveLength(2);
    expect(
      messages.every((message) => message.loggedDate === '2026-04-06')
    ).toBe(true);
  });

  it('sends nothing — and keeps the composer text — when consent is declined', async () => {
    const ensureAiConsent = vi.fn().mockResolvedValue(false);
    const { analyze, clear, messages, handleSubmit } =
      useSubmitHarness(ensureAiConsent);

    expect(await handleSubmit()).toBe(false);

    expect(ensureAiConsent).toHaveBeenCalledOnce();
    expect(analyze).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(messages).toHaveLength(0);
  });
});
