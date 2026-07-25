'use client';

import { useCallback, useRef, useState } from 'react';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import type { MealInputHandle } from '@/components/logging/input/meal-input';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { useClarifyHandlers } from '@/hooks/meals/use-clarify-handlers';
import { useConfirmHandlers } from '@/hooks/meals/use-confirm-handlers';
import { useFeedDay } from '@/hooks/meals/use-feed-day';
import { useFeedInvalidation } from '@/hooks/meals/use-feed-invalidation';
import { useFeedMessages } from '@/hooks/meals/use-feed-messages';
import { useFeedSubmit } from '@/hooks/meals/use-feed-submit';
import { useManualSubmit } from '@/hooks/meals/use-manual-submit';
import { useMealCardActions } from '@/hooks/meals/use-meal-card-actions';
import {
  useConfirmMeal,
  useSaveManualMeal,
} from '@/hooks/meals/use-meal-mutations';
import { useMealPrefill } from '@/hooks/meals/use-meal-prefill';
import { useRecentCheatOccasions } from '@/hooks/meals/use-recent-cheat-occasions';
import { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';
import { useStreamingScroll } from '@/hooks/meals/use-streaming-scroll';
import { useStreamingTerminalEffects } from '@/hooks/meals/use-streaming-terminal-effects';
import { useSubmitGuard } from '@/hooks/meals/use-submit-guard';
import { isLikelyPartialDay } from '@/lib/nutrition/pattern/completeness';
import type { CheatIntensity } from '@/lib/types/cheat';
import type { ChatMessage } from '@/lib/types/meal';

/**
 * Controller for the logging feed: owns the message list, streaming refs,
 * input mode, and the composition of every feed hook, so FeedArea itself is
 * render-only. Returned fields map 1:1 onto FeedArea's view regions.
 */
export function useFeedController(args: {
  selectedDate: string;
  today: string;
  profile: LoggingProfile;
  initialMeal: string | undefined;
  isDateNavigationPending: boolean;
  onInitialMealApplied: (() => void) | undefined;
}) {
  const {
    selectedDate,
    today,
    profile,
    initialMeal,
    isDateNavigationPending,
    onInitialMealApplied,
  } = args;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<MealInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stream = useStreamAnalysis();
  const { guard } = useSubmitGuard();

  // Persistence actions on a saved meal card (remove-with-undo, edit amounts,
  // log again, and the silent supersede used by NL-refine).
  const { handleDeleteMeal, handleUpdateMeal, handleLogAgain, replaceOldMeal } =
    useMealCardActions({ userId: profile.userId, selectedDate });
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  // Session-scoped dismissal for the "yesterday under-logged" prompt. The feed
  // stays mounted across date navigation, so this survives clicking through to
  // yesterday and back; a hard reload re-arms the once-daily nudge.
  const [yesterdayPromptDismissed, setYesterdayPromptDismissed] =
    useState(false);

  // Input mode: normal / manual / cheat.
  const [loggingMode, setLoggingMode] = useState<InputMode>('normal');
  // Indulgence magnitude (like an AI "thinking" level) — scales the estimate.
  const [cheatIntensity, setCheatIntensity] =
    useState<CheatIntensity>('medium');
  const isCheat = loggingMode === 'cheat';
  const recentCheatOccasions = useRecentCheatOccasions(profile.userId, isCheat);

  const day = useFeedDay({ profile, selectedDate, isDateNavigationPending });

  // Mutations
  const confirmMeal = useConfirmMeal(profile.userId);
  const saveManualMeal = useSaveManualMeal(profile.userId);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    });
  }, []);

  const lastAnalysisIdRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const confirmHandlers = useConfirmHandlers({
    stream,
    selectedDate,
    confirmMeal,
    replaceOldMeal,
    setMessages,
    setStreamingMsgId,
    lastAnalysisIdRef,
    lastErrorRef,
    scrollToBottom,
  });

  const clarifyHandlers = useClarifyHandlers({
    stream,
    selectedDate,
    cheatIntensity,
    setMessages,
    setStreamingMsgId,
    lastAnalysisIdRef,
    lastErrorRef,
    inputRef,
  });

  const { handleSubmit } = useFeedSubmit({
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
  });

  useMealPrefill({
    initialMeal,
    isCheat,
    isAnalyzing: stream.isAnalyzing,
    inputRef,
    onInitialMealApplied,
    handleSubmit,
  });

  const handleManualSubmit = useManualSubmit({
    inputRef,
    saveManualMeal,
    selectedDate,
    scrollToBottom,
  });

  const { handleAnalysisComplete, handleBarcodeSuccess } = useFeedInvalidation({
    userId: profile.userId,
    selectedDate,
    messages,
    streamingMsgId,
  });

  useStreamingTerminalEffects({
    stream,
    streamingMsgId,
    setStreamingMsgId,
    setMessages,
    scrollToBottom,
    lastAnalysisIdRef,
    lastErrorRef,
    onAnalysisComplete: handleAnalysisComplete,
  });

  const { pendingMessages, displayMessages, unconfirmedMessages } =
    useFeedMessages({
      messages,
      selectedDate,
      streamingMsgId,
      stream,
      pendingConfirmations: day.pendingConfirmations,
    });

  useStreamingScroll({ stream, scrollToBottom });

  const handleCancel = useCallback(() => {
    stream.cancel();
    if (streamingMsgId) {
      setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
    }
    setStreamingMsgId(null);
  }, [stream, streamingMsgId]);

  const hasPendingMessages = pendingMessages.length > 0;
  const hasStreamingMessages = displayMessages.some(
    (message) => message.role === 'assistant'
  );
  const hasPersistedMeals = day.persistedMeals.length > 0;
  const hasContent =
    hasPersistedMeals || hasPendingMessages || hasStreamingMessages;
  // ChatGPT-style: before anything is logged the composer sits centered with
  // the prompt; once there's content it animates down to the bottom while the
  // cards animate in. Not mode-based — purely content-driven.
  const isEmptyComposer =
    !hasContent && !stream.isAnalyzing && !day.isDayLoading && !day.isDayError;

  const isToday = selectedDate === today;
  const isPastDay = selectedDate < today;
  const showPartialDayNotice =
    isPastDay &&
    !day.isDayLoading &&
    !day.isDayError &&
    !day.hasUnknownDailyMacros &&
    hasPersistedMeals &&
    !hasPendingMessages &&
    !hasStreamingMessages &&
    isLikelyPartialDay(day.dailyTotals.calories, profile.calorieTarget);

  return {
    day,
    stream,
    inputRef,
    scrollRef,
    confirmMeal,
    unconfirmedMessages,
    ...confirmHandlers,
    ...clarifyHandlers,
    handleDeleteMeal,
    handleUpdateMeal,
    handleLogAgain,
    handleSubmit,
    handleManualSubmit,
    handleBarcodeSuccess,
    handleCancel,
    loggingMode,
    setLoggingMode,
    cheatIntensity,
    setCheatIntensity,
    isCheat,
    recentCheatOccasions,
    yesterdayPromptDismissed,
    setYesterdayPromptDismissed,
    hasContent,
    isEmptyComposer,
    isToday,
    showPartialDayNotice,
  };
}
