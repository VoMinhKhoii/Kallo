'use client';

import type { RefObject } from 'react';
import { toast } from 'sonner';
import type {
  StreamAnalysisState,
  StreamAnalyzeInput,
} from '@/hooks/use-stream-analysis';
import type { CheatIntensity } from '@/lib/types/cheat';
import type { ChatMessage } from '@/lib/types/meal';
import { mealTextSchema } from '@/lib/validation';

interface UseFeedSubmitParams {
  stream: StreamAnalysisState & {
    analyze: (input: StreamAnalyzeInput) => Promise<void>;
    reset: () => void;
  };
  selectedDate: string;
  inputRef: RefObject<{ getText: () => string; clear: () => void } | null>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setStreamingMsgId: (id: string | null) => void;
  scrollToBottom: () => void;
  guard: (fn: () => Promise<void>) => Promise<void>;
  lastAnalysisIdRef: RefObject<string | null>;
  lastErrorRef: RefObject<string | null>;
  /** When true, submit runs the cheat-meal slider estimator. */
  isCheat?: boolean;
  /** Indulgence magnitude passed to the cheat estimator. */
  cheatIntensity?: CheatIntensity;
}

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Pure factory: keep this free of React hooks so callers can unit-test it directly.
export function useFeedSubmit({
  stream,
  selectedDate,
  inputRef,
  setMessages,
  setStreamingMsgId,
  scrollToBottom,
  guard,
  lastAnalysisIdRef,
  lastErrorRef,
  isCheat,
  cheatIntensity,
}: UseFeedSubmitParams) {
  const handleSubmit = async () => {
    if (stream.isAnalyzing) return;
    const parsed = mealTextSchema.safeParse(inputRef.current?.getText());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Vui lòng nhập món ăn.');
      return;
    }
    const text = parsed.data;

    await guard(async () => {
      const assistantMsgId = generateId();
      setStreamingMsgId(assistantMsgId);
      lastAnalysisIdRef.current = null;
      lastErrorRef.current = null;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        loggedDate: selectedDate,
        timestamp: new Date(),
      };

      const streamingMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        userInput: text,
        loggedDate: selectedDate,
        timestamp: new Date(),
        isStreaming: true,
        streamingPhase: 'waiting',
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
      inputRef.current?.clear();
      scrollToBottom();

      await stream.analyze({
        message: text,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        ...(isCheat
          ? {
              mode: 'cheat' as const,
              cheatIntensity: cheatIntensity ?? 'medium',
            }
          : {}),
      });
    });
  };

  return { handleSubmit };
}
