'use client';

import type { RefObject } from 'react';
import { toast } from 'sonner';
import type {
  StreamAnalysisState,
  StreamAnalyzeInput,
} from '@/hooks/meals/analysis/use-stream-analysis';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import type { ChatMessage } from '@/lib/core/types/meal';
import { mealTextSchema } from '@/lib/core/validation/meal';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';
import type { RelogRef } from '@/lib/domain/logging/relog/relog';

interface UseFeedSubmitParams {
  stream: StreamAnalysisState & {
    analyze: (input: StreamAnalyzeInput) => Promise<boolean>;
    reset: () => void;
  };
  selectedDate: string;
  inputRef: RefObject<MealInputHandle | null>;
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
  /**
   * Analyze the composer's free text. `override` serves the combined-relog
   * case: the caller passes the composer text with the picked-dish mentions
   * stripped out (so the AI only ever sees genuinely new food) plus the picks
   * as `refs`, which the server resolves deterministically and merges into the
   * result — the relogged dishes are never re-analyzed.
   *
   * Returns whether the analysis DURABLY staged (an `analysis_complete`
   * arrived). `false` means the input was empty/invalid, a request was already
   * in flight, or the stream errored/clarified/ended early — in every one of
   * those cases the caller must NOT clear staged relog picks, or they'd vanish
   * behind a submit that produced no confirmable card.
   */
  const handleSubmit = async (override?: {
    message: string;
    refs?: RelogRef[];
    /** What the CARD should say, when that differs from what the AI is sent.
     *  A combined relog submits the free text alone but must still read as the
     *  whole meal — the server labels the persisted row
     *  `buildRelogRawInput([message, ...dishNames])`, so a card labelled with
     *  the free text alone silently grows the relogged dishes back the moment
     *  the persisted card replaces it. */
    label?: string;
  }): Promise<boolean> => {
    if (stream.isAnalyzing) return false;
    const parsed = mealTextSchema.safeParse(
      override ? override.message : inputRef.current?.getText()
    );
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Vui lòng nhập món ăn.');
      return false;
    }
    const text = parsed.data;
    const refs = override?.refs;
    // Falls back to the analyzed text, so every non-relog submit is unchanged.
    const label = override?.label ?? text;

    let durablyStaged = false;
    await guard(async () => {
      const assistantMsgId = generateId();
      // Stable per-attempt id: a clarify re-run of this card reuses it so the
      // server upserts one staging row instead of orphaning its predecessor.
      const attemptId = crypto.randomUUID();
      setStreamingMsgId(assistantMsgId);
      lastAnalysisIdRef.current = null;
      lastErrorRef.current = null;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: label,
        loggedDate: selectedDate,
        timestamp: new Date(),
      };

      const streamingMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        userInput: label,
        loggedDate: selectedDate,
        timestamp: new Date(),
        isStreaming: true,
        streamingPhase: 'waiting',
        attemptId,
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
      inputRef.current?.clear();
      scrollToBottom();

      durablyStaged = await stream.analyze({
        message: text,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        attemptId,
        ...(refs && refs.length > 0 ? { refs } : {}),
        ...(isCheat
          ? {
              mode: 'cheat' as const,
              cheatIntensity: cheatIntensity ?? 'medium',
            }
          : {}),
      });
    });
    return durablyStaged;
  };

  return { handleSubmit };
}
