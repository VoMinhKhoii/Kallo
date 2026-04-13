'use client';

import type { RefObject } from 'react';
import { toast } from 'sonner';
import type { StreamAnalysisState } from '@/hooks/use-stream-analysis';
import type { ChatMessage } from '@/lib/types/meal';
import { mealTextSchema } from '@/lib/validation';

interface UseFeedSubmitParams {
  stream: StreamAnalysisState & {
    analyze: (text: string) => Promise<void>;
    reset: () => void;
  };
  inputRef: RefObject<{ getText: () => string; clear: () => void } | null>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setStreamingMsgId: (id: string | null) => void;
  scrollToBottom: () => void;
  guard: (fn: () => Promise<void>) => Promise<void>;
  lastAnalysisIdRef: RefObject<string | null>;
  lastErrorRef: RefObject<string | null>;
}

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useFeedSubmit({
  stream,
  inputRef,
  setMessages,
  setStreamingMsgId,
  scrollToBottom,
  guard,
  lastAnalysisIdRef,
  lastErrorRef,
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
        timestamp: new Date(),
      };

      const streamingMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        userInput: text,
        timestamp: new Date(),
        isStreaming: true,
        streamingPhase: 'waiting',
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
      inputRef.current?.clear();
      scrollToBottom();

      await stream.analyze(text);
    });
  };

  return { handleSubmit };
}
