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

/**
 * The four ways an analysis stream can settle, made exclusive by construction so
 * one effect (not three racing ones) can finalize the streaming card:
 *   - `meal`            a precise `result` + durable analysisId.
 *   - `cheat`           a full cheat `cheatSpec` + durable analysisId.
 *   - `cheat-clarify`   a cheat spec carrying a clarifyingQuestion, no analysisId
 *                       (the vague-input fallback — client must re-ask).
 *   - `error`           a fatal `error`.
 *
 * `analysisId` is present only on `meal`/`cheat` (the durable ones): it both
 * dedupes the transition (via `lastAnalysisId`) and drives `onAnalysisComplete`.
 * `error` is deduped via `lastError`. `cheat-clarify` carries no id and relies on
 * the streamingMsgId-null + stream.reset() one-shot instead. `patch` is the
 * exact field set each original effect wrote onto the finalized card.
 */
type Terminal = {
  kind: 'meal' | 'cheat' | 'cheat-clarify' | 'error';
  msgId: string;
  /** Durable analysis id — only `meal`/`cheat`. Triggers dedupe + onComplete. */
  analysisId?: string;
  /** Error text — only `error`. Triggers dedupe + toast. */
  error?: string;
  patch: Partial<ChatMessage>;
};

/**
 * Pure classifier: given the settled stream + the one-shot guard state, return
 * the single terminal descriptor (or null when nothing should fire). Kept free
 * of side effects and refs writes — the effect performs those — so the branches
 * stay exclusive and hand-traceable.
 */
function deriveTerminal(
  s: Pick<
    StreamAnalysisState,
    'status' | 'result' | 'cheatSpec' | 'analysisId' | 'error'
  >,
  streamingMsgId: string | null,
  lastAnalysisId: string | null,
  lastError: string | null
): Terminal | null {
  if (!streamingMsgId) return null;

  // Error terminal. Deduped on the error string (a retry re-arms it once the
  // ref is cleared by the next analyze()).
  if (s.status === 'error') {
    if (!s.error || lastError === s.error) return null;
    return {
      kind: 'error',
      msgId: streamingMsgId,
      error: s.error,
      patch: {
        isStreaming: false,
        streamingPhase: undefined,
        streamingItems: undefined,
        streamingCompletedItems: undefined,
        parsedMeal: undefined,
        content: s.error,
      },
    };
  }

  if (s.status !== 'done') return null;

  // Payload terminals: a precise `result` meal, a full cheat `cheatSpec`, or a
  // cheat spec carrying a clarifyingQuestion (finalizes WITHOUT an analysisId).
  const isCheatClarify =
    s.cheatSpec?.clarifyingQuestion != null && !s.analysisId;
  const hasPayload = Boolean(s.result) || Boolean(s.cheatSpec);
  if (!hasPayload) return null;
  if (!s.analysisId && !isCheatClarify) return null;
  // Durable transitions are deduped on the analysisId; the cheat-clarify path
  // has no id, so it is never caught here (its one-shot is the reset below).
  if (s.analysisId != null && lastAnalysisId === s.analysisId) return null;

  const patch: Partial<ChatMessage> = {
    isStreaming: false,
    streamingPhase: 'done',
    streamingItems: undefined,
    streamingCompletedItems: undefined,
    parsedMeal: s.result ?? undefined,
    cheatSpec: s.cheatSpec ?? undefined,
    analysisId: s.analysisId ?? undefined,
  };

  if (isCheatClarify) {
    return { kind: 'cheat-clarify', msgId: streamingMsgId, patch };
  }
  // analysisId is guaranteed non-null here (guarded above): a `result` means a
  // precise meal, otherwise the `cheatSpec` is a full cheat estimate.
  return {
    kind: s.result ? 'meal' : 'cheat',
    msgId: streamingMsgId,
    analysisId: s.analysisId ?? undefined,
    patch,
  };
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
  const { status, result, cheatSpec, analysisId, error, reset } = stream;

  // Single terminal effect. `deriveTerminal` makes the four settle-paths
  // exclusive, so the shared epilogue (clear streamingMsgId → patch the card →
  // reset the stream → scroll) runs exactly once per transition. The one-shot
  // guards are preserved verbatim: the analysisId/error refs are written BEFORE
  // any state update so a strict-mode re-invocation (same committed state) sees
  // the guard and bails; `cheat-clarify` carries no id and instead trips on the
  // streamingMsgId-null + reset() the epilogue applies.
  useEffect(() => {
    const terminal = deriveTerminal(
      { status, result, cheatSpec, analysisId, error },
      streamingMsgId,
      lastAnalysisIdRef.current,
      lastErrorRef.current
    );
    if (!terminal) return;

    // Record the one-shot guards first (synchronous ref writes).
    if (terminal.analysisId) lastAnalysisIdRef.current = terminal.analysisId;
    if (terminal.kind === 'error' && terminal.error) {
      lastErrorRef.current = terminal.error;
    }

    setStreamingMsgId(null);

    if (terminal.kind === 'error' && terminal.error) {
      toast.error(terminal.error);
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === terminal.msgId ? { ...msg, ...terminal.patch } : msg
      )
    );

    // Durable analyses notify the invalidation layer; cheat-clarify/error don't.
    if (terminal.analysisId) onAnalysisComplete?.(terminal.analysisId);

    reset();
    scrollToBottom();
  }, [
    status,
    result,
    cheatSpec,
    analysisId,
    error,
    reset,
    streamingMsgId,
    scrollToBottom,
    lastAnalysisIdRef,
    lastErrorRef,
    onAnalysisComplete,
    setStreamingMsgId,
    setMessages,
  ]);

  // Terminal: pre-stream 402 — AI analysis is locked. Drop the in-flight
  // streaming bubble (no error toast) and open the paywall. Mirrors the error
  // path's cleanup but routes to the upgrade surface instead.
  useEffect(() => {
    if (status !== 'paymentRequired' || !streamingMsgId) return;

    const msgId = streamingMsgId;
    setStreamingMsgId(null);

    setMessages((prev) => prev.filter((msg) => msg.id !== msgId));

    onPaymentRequired?.();
    reset();
  }, [
    status,
    reset,
    streamingMsgId,
    onPaymentRequired,
    setStreamingMsgId,
    setMessages,
  ]);
}
