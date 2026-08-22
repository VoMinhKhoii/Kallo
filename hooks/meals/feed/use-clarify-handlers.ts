'use client';

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { useStreamAnalysis } from '@/hooks/meals/analysis/use-stream-analysis';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import type { ChatMessage } from '@/lib/core/types/meal';

/**
 * Cheat-mode clarify handler for the feed: the vague-input resubmit. Kept out of
 * useConfirmHandlers so that hook keeps a confirm/refine-only remit.
 */
export function useClarifyHandlers(args: {
  stream: ReturnType<typeof useStreamAnalysis>;
  selectedDate: string;
  cheatIntensity: CheatIntensity;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingMsgId: Dispatch<SetStateAction<string | null>>;
  lastAnalysisIdRef: MutableRefObject<string | null>;
  lastErrorRef: MutableRefObject<string | null>;
}) {
  const {
    stream,
    selectedDate,
    cheatIntensity,
    setMessages,
    setStreamingMsgId,
    lastAnalysisIdRef,
    lastErrorRef,
  } = args;

  // Vague-input fallback: the cheat estimator asked ONE question and staged
  // nothing, so re-run the SAME meal with the chosen answer.
  //   - clear cheatSpec so the card leaves its question state and streams again.
  //   - upsert the card (map when present, else append): the clarify may have
  //     come from a server pending row that is not in `messages`.
  const handleCheatClarify = (message: ChatMessage, answer: string) => {
    setStreamingMsgId(message.id);
    lastAnalysisIdRef.current = null;
    lastErrorRef.current = null;
    setMessages((prev) =>
      prev.some((m) => m.id === message.id)
        ? prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  cheatSpec: undefined,
                  isStreaming: true,
                  streamingPhase: 'waiting',
                }
              : m
          )
        : [
            ...prev,
            {
              ...message,
              cheatSpec: undefined,
              isStreaming: true,
              streamingPhase: 'waiting',
            },
          ]
    );
    void stream.analyze({
      message: message.userInput ?? message.content,
      loggedDate: selectedDate,
      timezoneOffset: new Date().getTimezoneOffset(),
      mode: 'cheat',
      cheatIntensity,
      clarifyAnswer: answer,
      // Reuse this card's attempt id so the resubmit supersedes the pre-clarify
      // staging row instead of orphaning it. (A clarifying-question spec stages
      // no row, so there's no orphan to supersede — but a double-fired clarify
      // would stage twice without a guard; the shared attempt id collapses that
      // to one row.)
      attemptId: message.attemptId,
    });
  };

  return { handleCheatClarify };
}
