'use client';

import type { RefObject } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { StreamAnalysisState } from '@/hooks/meals/use-stream-analysis';
import type { ChatMessage } from '@/lib/types/meal';

interface UseStreamingTerminalEffectsParams {
  stream: StreamAnalysisState & { reset: () => void };
  streamingMsgId: string | null;
  setStreamingMsgId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  scrollToBottom: () => void;
  lastAnalysisIdRef: RefObject<string | null>;
  lastErrorRef: RefObject<string | null>;
  onAnalysisComplete?: (analysisId: string) => void;
  // Pre-stream 402: AI analysis is locked. The surface opens the paywall
  // instead of showing an error toast.
  onPaymentRequired?: () => void;
}

export function useStreamingTerminalEffects({
  stream,
  streamingMsgId,
  setStreamingMsgId,
  setMessages,
  scrollToBottom,
  lastAnalysisIdRef,
  lastErrorRef,
  onAnalysisComplete,
  onPaymentRequired,
}: UseStreamingTerminalEffectsParams) {
  // Terminal: stream completed — finalize streaming message, store analysisId.
  // Two shapes settle here: a precise `result` meal, or a cheat `cheatSpec`.
  // The cheat clarify-question fallback finalizes WITHOUT an analysisId (the
  // client must re-ask), so it's allowed through explicitly.
  useEffect(() => {
    const isCheatClarify =
      stream.cheatSpec?.clarifyingQuestion != null && !stream.analysisId;
    const hasPayload = Boolean(stream.result) || Boolean(stream.cheatSpec);
    if (
      stream.status !== 'done' ||
      !hasPayload ||
      (!stream.analysisId && !isCheatClarify) ||
      (stream.analysisId != null &&
        lastAnalysisIdRef.current === stream.analysisId) ||
      !streamingMsgId
    ) {
      return;
    }
    const analysisId = stream.analysisId;
    if (analysisId) lastAnalysisIdRef.current = analysisId;
    const msgId = streamingMsgId;
    const cheatSpec = stream.cheatSpec;
    const result = stream.result;
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
              parsedMeal: result ?? undefined,
              cheatSpec: cheatSpec ?? undefined,
              analysisId: analysisId ?? undefined,
            }
          : msg
      )
    );
    if (analysisId) onAnalysisComplete?.(analysisId);
    stream.reset();
    scrollToBottom();
  }, [
    stream.status,
    stream.result,
    stream.cheatSpec,
    stream.analysisId,
    stream.reset,
    streamingMsgId,
    scrollToBottom,
    lastAnalysisIdRef,
    onAnalysisComplete,
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

  // Terminal: pre-stream 402 — AI analysis is locked. Drop the in-flight
  // streaming bubble (no error toast) and open the paywall. Mirrors the error
  // path's cleanup but routes to the upgrade surface instead.
  useEffect(() => {
    if (stream.status !== 'paymentRequired' || !streamingMsgId) return;

    const msgId = streamingMsgId;
    setStreamingMsgId(null);

    setMessages((prev) => prev.filter((msg) => msg.id !== msgId));

    onPaymentRequired?.();
    stream.reset();
  }, [
    stream.status,
    stream.reset,
    streamingMsgId,
    onPaymentRequired,
    setStreamingMsgId,
    setMessages,
  ]);
}
