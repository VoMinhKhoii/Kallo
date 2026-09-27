import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeOutcome } from '@/lib/ai/streaming/client-state';
import type { ChatMessage } from '@/lib/core/types/meal';
import { useFeedSubmit } from '../use-feed-submit';

function useSubmitHarness(outcome: AnalyzeOutcome = 'staged') {
  const analyze = vi.fn().mockResolvedValue(outcome);
  const clear = vi.fn();
  const setText = vi.fn();
  // An earlier, answered exchange: a consent refusal must leave it alone.
  const earlier: ChatMessage = {
    id: 'earlier-user',
    role: 'user',
    content: 'Cơm tấm',
    loggedDate: '2026-04-06',
    timestamp: new Date(),
  };
  const messages: ChatMessage[] = [earlier];

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
        setText,
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
  });

  return { analyze, clear, setText, messages, handleSubmit };
}

describe('useFeedSubmit', () => {
  it('date-scopes optimistic messages and analysis requests', async () => {
    const { analyze, clear, messages, handleSubmit } = useSubmitHarness();

    expect(await handleSubmit()).toBe(true);

    expect(clear).toHaveBeenCalled();
    expect(analyze).toHaveBeenCalledWith({
      message: 'Phở bò',
      loggedDate: '2026-04-06',
      timezoneOffset: expect.any(Number),
      attemptId: expect.any(String),
    });
    expect(messages).toHaveLength(3);
    expect(
      messages.every((message) => message.loggedDate === '2026-04-06')
    ).toBe(true);
  });

  it('takes back only its own exchange, and returns the words, when consent is declined', async () => {
    const { setText, messages, handleSubmit } =
      useSubmitHarness('consentDeclined');

    expect(await handleSubmit()).toBe(false);

    expect(messages.map((m) => m.id)).toEqual(['earlier-user']);
    expect(setText).toHaveBeenCalledWith('Phở bò', 'Phở bò'.length);
  });

  it('keeps the exchange for any other unstaged end (the error card owns it)', async () => {
    const { setText, messages, handleSubmit } = useSubmitHarness('notStaged');

    expect(await handleSubmit()).toBe(false);

    expect(messages).toHaveLength(3);
    expect(setText).not.toHaveBeenCalled();
  });
});
