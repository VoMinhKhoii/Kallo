'use client';

import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import type { MealInputHandle } from '@/components/logging/input/meal-input';
import type { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';
import type { CheatIntensity } from '@/lib/types/cheat';
import type { ChatMessage } from '@/lib/types/meal';

/**
 * Clarify handlers for the feed: the vague-input resubmit (cheat + precise) and
 * the discard-without-answering path. Split out of useConfirmHandlers so that
 * hook keeps a confirm/refine-only remit; the composer `inputRef` lives here
 * because only the discard path touches it (restoring unanswered text).
 */
export function useClarifyHandlers(args: {
  stream: ReturnType<typeof useStreamAnalysis>;
  selectedDate: string;
  cheatIntensity: CheatIntensity;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingMsgId: Dispatch<SetStateAction<string | null>>;
  lastAnalysisIdRef: MutableRefObject<string | null>;
  lastErrorRef: MutableRefObject<string | null>;
  /** Composer handle — a discarded clarify restores its raw text here. */
  inputRef: RefObject<MealInputHandle | null>;
}) {
  const {
    stream,
    selectedDate,
    cheatIntensity,
    setMessages,
    setStreamingMsgId,
    lastAnalysisIdRef,
    lastErrorRef,
    inputRef,
  } = args;

  // Clarify resubmit: the pipeline asked ONE question and staged nothing (cheat
  // clarifying-question fallback OR precise clarify), so re-run the SAME meal
  // with the typed answer. Cheat and precise clarifies differ only in `mode`
  // and which inert extra they carry, so they share this one path:
  //   - clear BOTH cheatSpec and preciseClarify — only one is ever set on a
  //     given card, so clearing the other is a no-op.
  //   - upsert the card (map when present, else append): the cheat clarify may
  //     have come from a server pending row not yet in `messages`; the precise
  //     clarify is always local, so its append branch never runs (safe superset).
  //   - pass cheatIntensity and inheritLoggedAt unconditionally: cheatIntensity
  //     is ignored by the precise pipeline, and inheritLoggedAt is undefined on
  //     cheat cards — each is inert in the other mode.
  const handleClarifyResubmit = (
    message: ChatMessage,
    answer: string,
    mode: 'cheat' | 'precise'
  ) => {
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
                  preciseClarify: undefined,
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
              preciseClarify: undefined,
              isStreaming: true,
              streamingPhase: 'waiting',
            },
          ]
    );
    void stream.analyze({
      message: message.userInput ?? message.content,
      loggedDate: selectedDate,
      timezoneOffset: new Date().getTimezoneOffset(),
      mode,
      // Inert in precise mode (the precise pipeline ignores it).
      cheatIntensity,
      clarifyAnswer: answer,
      // Reuse this card's attempt id so the resubmit supersedes the pre-clarify
      // staging row instead of orphaning it. (A clarifying-question spec stages
      // no row, so there's no orphan to supersede — but a double-fired clarify
      // would stage twice without a guard; the shared attempt id collapses that
      // to one row.)
      attemptId: message.attemptId,
      // Carry the refine's origin anchor through so the corrected meal keeps the
      // original's instant/slot. Undefined on cheat cards and normal logs.
      inheritLoggedAt: message.inheritLoggedAt,
    });
  };

  // Vague-input fallback: re-run the cheat estimator with the chosen answer.
  const handleCheatClarify = (message: ChatMessage, answer: string) =>
    handleClarifyResubmit(message, answer, 'cheat');

  // Precise-mode clarify resubmit — always answered precisely, regardless of the
  // composer's current mode.
  const handlePreciseClarify = (message: ChatMessage, answer: string) =>
    handleClarifyResubmit(message, answer, 'precise');

  // Discard a precise-clarify prompt without answering: drop the card and
  // restore its raw text into the composer (never destroy what the user typed).
  // Removing the message retires its attempt id, so the next submit mints a
  // fresh one. Nothing was staged server-side, so there is no pending twin to
  // clean up.
  const handleDiscardClarify = (message: ChatMessage) => {
    const text = message.userInput ?? message.content;
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    if (text && inputRef.current?.getText().trim() === '') {
      inputRef.current.setText(text);
    }
  };

  return {
    handleCheatClarify,
    handlePreciseClarify,
    handleDiscardClarify,
  };
}
