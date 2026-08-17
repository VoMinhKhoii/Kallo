'use client';

import { useCallback, useRef, useState } from 'react';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import type { MealInputHandle } from '@/components/logging/input/meal-input';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { useRelogComposer } from '@/hooks/meals/relog/use-relog-composer';
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
import { useSettledOnce } from '@/hooks/meals/use-settled-once';
import { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';
import { useStreamingScroll } from '@/hooks/meals/use-streaming-scroll';
import { useStreamingTerminalEffects } from '@/hooks/meals/use-streaming-terminal-effects';
import { useSubmitGuard } from '@/hooks/meals/use-submit-guard';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import type { ChatMessage } from '@/lib/core/types/meal';
import { isLikelyPartialDay } from '@/lib/domain/nutrition/pattern/completeness';

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
  onPaymentRequired: (() => void) | undefined;
  /**
   * The SERVER's answer to "does this day hold anything?", read before the page
   * was sent. Undefined when it could not answer — no timezone cookie yet, or
   * the lookup failed.
   */
  initiallyHasEntries: boolean | undefined;
}) {
  const {
    selectedDate,
    today,
    profile,
    initialMeal,
    isDateNavigationPending,
    onInitialMealApplied,
    onPaymentRequired,
    initiallyHasEntries,
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

  // The `/` relog picker + its staged list. Normal mode only — manual and cheat
  // own the composer's slots themselves. Submit is unified: text-only meals go
  // through the AI path, pure picks stage a deterministic review card, and a
  // mix of the two analyzes the text alone with the picks merged server-side.
  const relog = useRelogComposer({
    selectedDate,
    loggingMode,
    inputRef,
    scrollToBottom,
    setMessages,
    handleSubmit,
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
    onPaymentRequired,
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
  // What we currently believe this day holds. While the query is in flight that
  // is whatever the server worked out before the page was sent; once it answers,
  // the answer itself. Undefined means the server had nothing to offer — no
  // timezone cookie on a first visit — and the old assumption stands.
  //
  // ONE belief, read by everything that depends on it. Expressed twice it was
  // two ternaries in opposite polarity (`!== false` against `=== false`) that a
  // reader had to reconcile to see they were the same question.
  const expectEntries = day.isDayLoading
    ? (initiallyHasEntries ?? true)
    : hasContent;
  const isEmptyComposer =
    !expectEntries && !stream.isAnalyzing && !day.isDayError;

  // The composer's layout spring is for the user LOGGING something — the bar
  // gliding down to the bottom as their first meal card takes the space. It is
  // NOT for data arriving: while the day query is in flight the composer is
  // docked at the bottom, and an empty day resolving moves it to the centre, so
  // every cold load of an empty day ended with the bar visibly flying up the
  // screen. Held off until the query has answered once; the reposition that
  // answer causes then happens in the same frame as the skeleton clearing,
  // which reads as the page loading rather than as the bar travelling.
  const animateComposerLayout = useSettledOnce(day.isDayLoading);

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
    relog,
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
    expectEntries,
    isEmptyComposer,
    animateComposerLayout,
    isToday,
    showPartialDayNotice,
  };
}
