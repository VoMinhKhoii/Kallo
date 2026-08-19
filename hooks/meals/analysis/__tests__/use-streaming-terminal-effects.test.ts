import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StreamAnalysisState } from '@/hooks/meals/analysis/use-stream-analysis';
import { useStreamingTerminalEffects } from '@/hooks/meals/analysis/use-streaming-terminal-effects';
import type { ChatMessage } from '@/lib/core/types/meal';

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (msg: string) => toastError(msg) },
}));

function baseStream(
  overrides: Partial<StreamAnalysisState>
): StreamAnalysisState & { reset: () => void } {
  return {
    status: 'idle',
    items: [],
    completedItems: [],
    result: null,
    cheatSpec: null,
    analysisId: null,
    error: null,
    isAnalyzing: false,
    reset: vi.fn(),
    ...overrides,
  };
}

describe('useStreamingTerminalEffects — paymentRequired', () => {
  it('opens the paywall, drops the streaming bubble, and does not toast', () => {
    const onPaymentRequired = vi.fn();
    const setStreamingMsgId = vi.fn();
    const setMessages = vi.fn();
    const stream = baseStream({
      status: 'paymentRequired',
      error: 'Your free trial has ended — upgrade to keep analyzing meals.',
    });

    renderHook(() =>
      useStreamingTerminalEffects({
        stream,
        streamingMsgId: 'msg-1',
        setStreamingMsgId,
        setMessages,
        scrollToBottom: vi.fn(),
        lastAnalysisIdRef: { current: null },
        lastErrorRef: { current: null },
        onPaymentRequired,
      })
    );

    expect(onPaymentRequired).toHaveBeenCalledTimes(1);
    expect(setStreamingMsgId).toHaveBeenCalledWith(null);
    expect(stream.reset).toHaveBeenCalledTimes(1);
    // No error toast on the paywall path.
    expect(toastError).not.toHaveBeenCalled();

    // The streaming bubble is removed (functional updater filters it out).
    const updater = setMessages.mock.calls[0][0] as (
      prev: ChatMessage[]
    ) => ChatMessage[];
    const next = updater([
      { id: 'msg-1', role: 'assistant', content: '', timestamp: new Date() },
      { id: 'msg-2', role: 'assistant', content: '', timestamp: new Date() },
    ] as ChatMessage[]);
    expect(next.map((m) => m.id)).toEqual(['msg-2']);
  });

  it('does nothing when there is no active streaming message', () => {
    const onPaymentRequired = vi.fn();
    const stream = baseStream({ status: 'paymentRequired' });

    renderHook(() =>
      useStreamingTerminalEffects({
        stream,
        streamingMsgId: null,
        setStreamingMsgId: vi.fn(),
        setMessages: vi.fn(),
        scrollToBottom: vi.fn(),
        lastAnalysisIdRef: { current: null },
        lastErrorRef: { current: null },
        onPaymentRequired,
      })
    );

    expect(onPaymentRequired).not.toHaveBeenCalled();
  });
});
