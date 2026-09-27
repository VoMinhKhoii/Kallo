import { act, renderHook } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useStreamAnalysis } from '@/hooks/meals/analysis/use-stream-analysis';
import { useClarifyHandlers } from '@/hooks/meals/feed/use-clarify-handlers';
import { useConfirmHandlers } from '@/hooks/meals/feed/use-confirm-handlers';
import type { useConfirmMeal } from '@/hooks/meals/mutations/use-confirm-meal';
import type { CheatSliderSpec } from '@/lib/core/types/cheat';
import type { ChatMessage } from '@/lib/core/types/meal';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/actions/meals/cheat/occasions', () => ({
  stageCheatRepeatAction: vi.fn(),
}));

// "Not now" to AI processing on a refine or a clarify sends nothing, and must
// not take anything the user already had off the feed: a clarify's cheat card,
// or the bubble sitting before the new run.

const unrelated: ChatMessage = {
  id: 'earlier-user',
  role: 'user',
  content: 'Cơm tấm',
  loggedDate: '2026-09-25',
  timestamp: new Date('2026-09-25T08:00:00Z'),
};

const question = {
  sliders: [],
  mealSlot: null,
  confidence: 'low',
  clarifyingQuestion: { question: 'Which buffet?', options: ['Lẩu', 'BBQ'] },
} as unknown as CheatSliderSpec;

const cheatCard: ChatMessage = {
  id: 'cheat-card',
  role: 'assistant',
  content: '',
  userInput: 'buffet',
  loggedDate: '2026-09-25',
  timestamp: new Date('2026-09-25T09:00:00Z'),
  cheatSpec: question,
  attemptId: 'attempt-1',
};

function declinedStream() {
  return {
    isAnalyzing: false,
    analyze: vi.fn().mockResolvedValue('consentDeclined'),
  } as unknown as ReturnType<typeof useStreamAnalysis>;
}

function feed(initial: ChatMessage[]) {
  const messages = { current: [...initial] };
  const setMessages: Dispatch<SetStateAction<ChatMessage[]>> = (update) => {
    messages.current =
      typeof update === 'function' ? update(messages.current) : update;
  };
  return { messages, setMessages };
}

const refs = () => ({
  setStreamingMsgId: vi.fn(),
  lastAnalysisIdRef: { current: null },
  lastErrorRef: { current: null },
});

describe('a declined AI consent', () => {
  it('puts a clarify card back to asking its question — never deletes it', async () => {
    const { messages, setMessages } = feed([unrelated, cheatCard]);
    const stream = declinedStream();
    const { result } = renderHook(() =>
      useClarifyHandlers({
        stream,
        selectedDate: '2026-09-25',
        cheatIntensity: 'medium',
        setMessages,
        ...refs(),
      })
    );

    await act(() => result.current.handleCheatClarify(cheatCard, 'Lẩu'));

    expect(stream.analyze).toHaveBeenCalledOnce();
    expect(messages.current).toEqual([unrelated, cheatCard]);
  });

  it('takes back only the correction card a refine added', async () => {
    const { messages, setMessages } = feed([unrelated, cheatCard]);
    const stream = declinedStream();
    const { result } = renderHook(() =>
      useConfirmHandlers({
        stream,
        selectedDate: '2026-09-25',
        confirmMeal: {} as ReturnType<typeof useConfirmMeal>,
        replaceOldMeal: vi.fn(),
        setMessages,
        scrollToBottom: vi.fn(),
        ...refs(),
      })
    );

    await act(() =>
      result.current.handleRefineMeal(
        { id: 'meal-1', rawInput: 'phở bò', loggedAt: '2026-09-25T07:00:00Z' },
        'no onions'
      )
    );

    expect(stream.analyze).toHaveBeenCalledOnce();
    expect(messages.current).toEqual([unrelated, cheatCard]);
  });
});
