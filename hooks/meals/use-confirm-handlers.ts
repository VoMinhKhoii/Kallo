'use client';

import { useTranslations } from 'next-intl';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import type { useConfirmMeal } from '@/hooks/meals/use-meal-mutations';
import type { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';
import { stageCheatRepeatAction } from '@/lib/actions/meals/cheat';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';
import type { CheatIntensity, CheatSliderLevels } from '@/lib/types/cheat';
import type {
  ChatMessage,
  MacroBreakdown,
  MealQuantityEdit,
} from '@/lib/types/meal';
import { MEAL_TEXT_MAX_LENGTH } from '@/lib/validation';

const emptyMacros: MacroBreakdown = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

/**
 * Confirm / cheat / refine handlers for the feed. They mutate the shared
 * message list and streaming refs owned by FeedArea (passed in, matching the
 * useFeedSubmit / useStreamingTerminalEffects pattern) and keep the NL-refine
 * "replaces meal X" bookkeeping internal.
 */
export function useConfirmHandlers(args: {
  stream: ReturnType<typeof useStreamAnalysis>;
  selectedDate: string;
  cheatIntensity: CheatIntensity;
  confirmMeal: ReturnType<typeof useConfirmMeal>;
  replaceOldMeal: (mealId: string) => Promise<void>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingMsgId: Dispatch<SetStateAction<string | null>>;
  lastAnalysisIdRef: MutableRefObject<string | null>;
  lastErrorRef: MutableRefObject<string | null>;
  scrollToBottom: () => void;
  /** Composer handle — a discarded clarify restores its raw text here. */
  inputRef: MutableRefObject<{
    getText: () => string;
    setText: (text: string) => void;
  } | null>;
}) {
  const {
    stream,
    selectedDate,
    cheatIntensity,
    confirmMeal,
    replaceOldMeal,
    setMessages,
    setStreamingMsgId,
    lastAnalysisIdRef,
    lastErrorRef,
    scrollToBottom,
    inputRef,
  } = args;
  const t = useTranslations('logging.feedArea');

  // "Log it again" — re-staging a past cheat occasion (a quick DB insert, no AI).
  const [isStagingRepeat, setIsStagingRepeat] = useState(false);

  // NL-refine bookkeeping: maps a refine streaming-message id → the persisted
  // meal it replaces. When that re-analysis is confirmed, the old meal is
  // deleted so the corrected meal supersedes it instead of stacking.
  const replacedMealByMsgIdRef = useRef<Map<string, string>>(new Map());

  // NL-refine: re-run the analysis waterfall on the meal's text plus a plain
  // correction, then replace the meal. We reuse the streaming surface — a fresh
  // pending card streams in exactly like a new log — and register the old meal
  // id so confirming the correction deletes the original (no stacking).
  const handleRefineMeal = useCallback(
    (
      meal: { id: string; rawInput: string; loggedAt: string },
      correction: string
    ) => {
      if (stream.isAnalyzing) return;
      // The pipeline reads the whole meal afresh; the parenthetical carries the
      // correction as a same-line aside so decomposition keeps the dish context.
      // The server caps messages at MEAL_TEXT_MAX_LENGTH — when the original
      // text plus the correction (and the 3 joining chars) would exceed it,
      // truncate the original so the analysis is never rejected.
      const baseBudget = MEAL_TEXT_MAX_LENGTH - correction.length - 3;
      const base =
        meal.rawInput.length > baseBudget
          ? meal.rawInput.slice(0, Math.max(baseBudget, 0)).trimEnd()
          : meal.rawInput;
      const combined = `${base} (${correction})`;
      const assistantMsgId = crypto.randomUUID();
      // A refine is a fresh logging attempt (a new correction card), so it mints
      // its own attempt id — re-runs of THIS card supersede its staging row.
      const attemptId = crypto.randomUUID();
      replacedMealByMsgIdRef.current.set(assistantMsgId, meal.id);
      setStreamingMsgId(assistantMsgId);
      lastAnalysisIdRef.current = null;
      lastErrorRef.current = null;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          userInput: combined,
          loggedDate: selectedDate,
          timestamp: new Date(),
          isStreaming: true,
          streamingPhase: 'waiting',
          attemptId,
          // Anchor carried on the card so a clarify round-trip keeps it (the
          // terminal effect spreads ...msg, preserving this field).
          inheritLoggedAt: meal.loggedAt,
        },
      ]);
      scrollToBottom();

      void stream.analyze({
        message: combined,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        attemptId,
        // Keep the corrected meal anchored to the original's instant/slot.
        inheritLoggedAt: meal.loggedAt,
      });
    },
    [
      stream,
      selectedDate,
      scrollToBottom,
      setMessages,
      setStreamingMsgId,
      lastAnalysisIdRef,
      lastErrorRef,
    ]
  );

  const handleConfirmMeal = (
    message: ChatMessage,
    edits: MealQuantityEdit[]
  ) => {
    // The caller already holds the fully-built message — from either the local
    // stream or a server-loaded pending confirmation — so the optimistic cache
    // update can build the meal straight from it. (Re-deriving it from
    // `messages` here would miss server-backed pending cards, which never enter
    // that array, and silently drop the save.)
    //
    // Guard FIRST: without a parsedMeal/analysisId there is nothing to confirm,
    // and filtering on an `undefined` analysisId below would drop every message
    // that DOES have one.
    if (!message.parsedMeal || !message.analysisId) return;
    // Drop any local copy before mutate so the optimistic cache update in
    // useConfirmMeal does not briefly expose it as an unsaved card. This is a
    // no-op for server-loaded pending cards.
    setMessages((prev) =>
      prev.filter(
        (m) => m.id !== message.id && m.analysisId !== message.analysisId
      )
    );
    // Client-minted id: doubles as the persisted row's PK and an idempotency
    // key, so the optimistic card and the refetched row share one stable React
    // key (no remount/re-fade after save).
    const mealId = crypto.randomUUID();
    // If this card came from an NL-refine, the meal it corrects is deleted on
    // confirm so the correction supersedes the original rather than stacking.
    const replacedMealId = replacedMealByMsgIdRef.current.get(message.id);
    confirmMeal.mutate(
      {
        analysisId: message.analysisId,
        mealId,
        originDate: selectedDate,
        parsedMeal: message.parsedMeal,
        rawInput: message.userInput ?? message.content,
        loggedAt: message.timestamp.toISOString(),
        edits: edits.length > 0 ? edits : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('savedMeal'));
          if (replacedMealId) {
            replacedMealByMsgIdRef.current.delete(message.id);
            void replaceOldMeal(replacedMealId);
          }
        },
      }
    );
  };

  const handleConfirmCheatMeal = (
    message: ChatMessage,
    levels: CheatSliderLevels
  ) => {
    // Take the rendered message directly rather than re-finding it in `messages`:
    // a server-loaded pending cheat card is rendered from `pendingConfirmations`
    // and never enters `messages`, so a lookup there would miss it and silently
    // drop the confirm. (Mirrors handleConfirmMeal.)
    if (!message.analysisId || !message.cheatSpec) return;
    setMessages((prev) =>
      prev.filter(
        (m) => m.id !== message.id && m.analysisId !== message.analysisId
      )
    );
    const mealId = crypto.randomUUID();
    confirmMeal.mutate(
      {
        analysisId: message.analysisId,
        mealId,
        originDate: selectedDate,
        // Cheat meals have no ParsedMeal; the optimistic card is built from the
        // spec + levels instead.
        parsedMeal: { mealName: '', items: [], totalMacros: emptyMacros },
        rawInput: message.userInput ?? message.content,
        loggedAt: message.timestamp.toISOString(),
        levels,
        cheat: { spec: message.cheatSpec, levels },
      },
      {
        onSuccess: () => {
          toast.success(t('savedMeal'));
        },
      }
    );
  };

  // Vague-input fallback: re-run the cheat estimator with the chosen answer.
  const handleCheatClarify = (message: ChatMessage, answer: string) => {
    setStreamingMsgId(message.id);
    lastAnalysisIdRef.current = null;
    lastErrorRef.current = null;
    // Update the local message in place, or seed it if this card came from a
    // server pending row (not yet in `messages`) — so the streaming overlay has
    // a message to attach to.
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
      // Reuse this card's attempt id. A clarifying-question spec stages no row
      // (the route returns early), so there's no pre-clarify orphan to supersede
      // here — but this handler has no in-flight guard, so a double-fired clarify
      // would stage twice; the shared attempt id collapses that to one row.
      attemptId: message.attemptId,
    });
  };

  // Precise-mode clarify resubmit: the pipeline asked ONE question and staged
  // nothing, so re-run the SAME meal on the precise pipeline with the typed
  // answer. Mirrors handleCheatClarify, minus cheat mode — a precise clarify is
  // always answered precisely, regardless of the composer's current mode.
  const handlePreciseClarify = (message: ChatMessage, answer: string) => {
    setStreamingMsgId(message.id);
    lastAnalysisIdRef.current = null;
    lastErrorRef.current = null;
    // The clarify card is always a local message (nothing was staged, so there
    // is no server-pending twin) — flip it back to streaming in place.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              preciseClarify: undefined,
              isStreaming: true,
              streamingPhase: 'waiting',
            }
          : m
      )
    );
    void stream.analyze({
      message: message.userInput ?? message.content,
      loggedDate: selectedDate,
      timezoneOffset: new Date().getTimezoneOffset(),
      // Force precise — never inherit a cheat composer mode for a precise clarify.
      mode: 'precise',
      clarifyAnswer: answer,
      // Reuse this card's attempt id so the resubmit supersedes the pre-clarify
      // staging row instead of orphaning it (mirrors handleCheatClarify).
      attemptId: message.attemptId,
      // Carry the refine's origin anchor through the clarify so the corrected
      // meal keeps the original's instant/slot (undefined on normal logs).
      inheritLoggedAt: message.inheritLoggedAt,
    });
  };

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

  // "Log it again": re-stage a past cheat occasion's sliders (seeded with last
  // time's amounts) without re-running the estimator, then surface the card.
  const handleRepeatCheat = async (occasion: RecentCheatOccasion) => {
    if (isStagingRepeat || stream.isAnalyzing) return;
    setIsStagingRepeat(true);
    try {
      const staged = await stageCheatRepeatAction({
        sourceMealId: occasion.mealId,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          cheatSpec: staged.spec,
          userInput: staged.rawInput,
          timestamp: new Date(staged.loggedAt),
          loggedDate: selectedDate,
          analysisId: staged.analysisId,
        },
      ]);
      scrollToBottom();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('repeatError'));
    } finally {
      setIsStagingRepeat(false);
    }
  };

  return {
    isStagingRepeat,
    handleRefineMeal,
    handleConfirmMeal,
    handleConfirmCheatMeal,
    handleCheatClarify,
    handlePreciseClarify,
    handleDiscardClarify,
    handleRepeatCheat,
  };
}
