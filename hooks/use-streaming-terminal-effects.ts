'use client';

import type { RefObject } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { StreamAnalysisState } from '@/hooks/use-stream-analysis';
import type { ChatMessage } from '@/lib/types/meal';

interface UseStreamingTerminalEffectsParams {
  stream: StreamAnalysisState & { reset: () => void };
  streamingMsgId: string | null;
  setStreamingMsgId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  scrollToBottom: () => void;
  lastAnalysisIdRef: RefObject<string | null>;
  lastErrorRef: RefObject<string | null>;
}

export function useStreamingTerminalEffects({
  stream,
  streamingMsgId,
  setStreamingMsgId,
  setMessages,
  scrollToBottom,
  lastAnalysisIdRef,
  lastErrorRef,
}: UseStreamingTerminalEffectsParams) {
  // Terminal: stream completed — finalize streaming message, store analysisId
  useEffect(() => {
    if (
      stream.status !== 'done' ||
      !stream.result ||
      !stream.analysisId ||
      lastAnalysisIdRef.current === stream.analysisId ||
      !streamingMsgId
    ) {
      return;
    }
    lastAnalysisIdRef.current = stream.analysisId;
    const msgId = streamingMsgId;
    const analysisId = stream.analysisId;
    setStreamingMsgId(null);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? {
              ...msg,
              isStreaming: false,
              streamingPhase: 'done' as const,
              streamingItems: undefined,
              streamingCompletedItems: undefined,
              parsedMeal: stream.result!,
              analysisId,
            }
          : msg
      )
    );
    stream.reset();
    scrollToBottom();
  }, [
    stream.status,
    stream.result,
    stream.analysisId,
    stream.reset,
    streamingMsgId,
    scrollToBottom,
    lastAnalysisIdRef,
    setStreamingMsgId,
    setMessages,
  ]);

  // Terminal: stream errored
  useEffect(() => {
    if (
      stream.status !== 'error' ||
      !stream.error ||
      lastErrorRef.current === stream.error ||
      !streamingMsgId
    ) {
      return;
    }
    lastErrorRef.current = stream.error;
    const msgId = streamingMsgId;
    setStreamingMsgId(null);

    toast.error(stream.error);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? {
              ...msg,
              isStreaming: false,
              streamingPhase: undefined,
              streamingItems: undefined,
              streamingCompletedItems: undefined,
              parsedMeal: undefined,
              content: stream.error!,
            }
          : msg
      )
    );
    stream.reset();
    scrollToBottom();
  }, [
    stream.status,
    stream.error,
    stream.reset,
    streamingMsgId,
    scrollToBottom,
    lastErrorRef,
    setStreamingMsgId,
    setMessages,
  ]);
}
