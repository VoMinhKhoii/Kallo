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
import type { useStreamAnalysis } from '@/hooks/meals/analysis/use-stream-analysis';
import type { useConfirmMeal } from '@/hooks/meals/mutations/use-confirm-meal';
import { stageCheatRepeatAction } from '@/lib/actions/meals/cheat';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';
import type { CheatSliderLevels } from '@/lib/core/types/cheat';
import type {
  ChatMessage,
  MacroBreakdown,
  MealQuantityEdit,
} from '@/lib/core/types/meal';
import { MEAL_TEXT_MAX_LENGTH } from '@/lib/core/validation/meal';

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
  confirmMeal: ReturnType<typeof useConfirmMeal>;
  replaceOldMeal: (mealId: string) => Promise<void>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingMsgId: Dispatch<SetStateAction<string | null>>;
  lastAnalysisIdRef: MutableRefObject<string | null>;
  lastErrorRef: MutableRefObject<string | null>;
  scrollToBottom: () => void;
}) {
  const {
    stream,
    selectedDate,
    confirmMeal,
    replaceOldMeal,
    setMessages,
    setStreamingMsgId,
    lastAnalysisIdRef,
    lastErrorRef,
    scrollToBottom,
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
    handleRepeatCheat,
  };
}
