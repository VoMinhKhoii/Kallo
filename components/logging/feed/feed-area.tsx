'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheatOccasionChips } from '@/components/logging/feed/cheat-occasion-chips';
import { CheatSliderCard } from '@/components/logging/feed/cheat-slider-card';
import { EmptyState } from '@/components/logging/feed/empty-state';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { MealEntry } from '@/components/logging/feed/meal-entry';
import { PartialDayNotice } from '@/components/logging/feed/partial-day-notice';
import { PartialYesterdayPrompt } from '@/components/logging/feed/partial-yesterday-prompt';
import { PersistedMealCard } from '@/components/logging/feed/persisted-meal-card';
import { StreamingMealEntry } from '@/components/logging/feed/streaming-meal-entry';
import {
  MealInput,
  type MealInputHandle,
} from '@/components/logging/input/meal-input';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { addDays } from '@/components/logging/sidebar/timeline-utils';
import { useFeedSubmit } from '@/hooks/use-feed-submit';
import { loggingDayKeys, useLoggingDay } from '@/hooks/use-logging-day';
import { useConfirmMeal } from '@/hooks/use-meal-mutations';
import { useRecentCheatOccasions } from '@/hooks/use-recent-cheat-occasions';
import { useStreamAnalysis } from '@/hooks/use-stream-analysis';
import { useStreamingTerminalEffects } from '@/hooks/use-streaming-terminal-effects';
import { useSubmitGuard } from '@/hooks/use-submit-guard';
import {
  type RecentCheatOccasion,
  stageCheatRepeatAction,
} from '@/lib/actions/meals';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import { isLikelyPartialDay } from '@/lib/nutrition/pattern/completeness';
import type { CheatIntensity, CheatSliderLevels } from '@/lib/types/cheat';
import type {
  ChatMessage,
  MacroBreakdown,
  MealQuantityEdit,
  StreamingPhase,
} from '@/lib/types/meal';
import { cn } from '@/lib/utils';

const emptyMacros: MacroBreakdown = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

function toStreamingPhase(status: string): StreamingPhase {
  switch (status) {
    case 'decomposing':
      return 'decomposing';
    case 'matching':
      return 'matching';
    case 'estimating':
      return 'estimating';
    case 'assembling':
      return 'assembling';
    case 'done':
    case 'error':
      return 'assembling';
    default:
      return 'waiting';
  }
}

interface FeedAreaProps {
  selectedDate: string;
  today: string;
  profile: LoggingProfile;
  initialMeal?: string;
  isDateNavigationPending?: boolean;
  onInitialMealApplied?: () => void;
  onSelectDate: (date: string) => void;
}

function MacroSummarySkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {[64, 52, 58, 48].map((width, index) => (
        <div
          key={index}
          className="rounded-2xl border border-nham-border/50 bg-nham-hover/25 p-3"
        >
          <div
            className="mb-2 h-3 rounded-full bg-nham-border/70"
            style={{ width }}
          />
          <div className="h-5 w-16 rounded-full bg-nham-accent/25" />
        </div>
      ))}
    </div>
  );
}

function LoggingDaySkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="logging-day-skeleton"
      className="mx-auto w-full max-w-3xl pl-6 sm:pl-12"
    >
      <div className="flex animate-pulse flex-col gap-8">
        {[0, 1].map((item) => (
          <div key={item} className="group relative">
            <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/50 group-last:bg-transparent" />
            <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-accent/70 bg-nham-surface" />
            <div className="mb-2 h-3 w-16 rounded-full bg-nham-border/70" />
            <div className="rounded-2xl border border-nham-border/60 bg-nham-hover/20 p-5 shadow-sm">
              <div className="mb-4 h-5 w-2/3 rounded-full bg-nham-border/70" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-nham-border/60" />
                <div className="h-3 w-5/6 rounded-full bg-nham-border/50" />
                <div className="h-3 w-3/5 rounded-full bg-nham-border/40" />
              </div>
              <div className="mt-5 flex items-center justify-between border-nham-border/50 border-t border-dashed pt-3">
                <div className="h-3 w-28 rounded-full bg-nham-border/50" />
                <div className="h-4 w-16 rounded-full bg-nham-accent/25" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoggingDayErrorStateProps {
  onRetry: () => void;
  isRetrying: boolean;
}

function LoggingDayErrorState({
  onRetry,
  isRetrying,
}: LoggingDayErrorStateProps) {
  const t = useTranslations('logging.feedArea');

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-red-200/70 bg-red-50/80 p-4 text-red-950 shadow-sm"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{t('loadErrorTitle')}</p>
            <p className="mt-1 text-red-900/80 text-sm">
              {t('loadErrorDescription')}
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              aria-busy={isRetrying}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-red-100 px-3.5 py-2 font-medium text-red-950 text-sm transition-colors hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRetrying && 'animate-spin')}
                aria-hidden="true"
              />
              {t('retryDay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedArea({
  selectedDate,
  today,
  profile,
  initialMeal,
  isDateNavigationPending = false,
  onInitialMealApplied,
  onSelectDate,
}: FeedAreaProps) {
  const t = useTranslations('logging.feedArea');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<MealInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stream = useStreamAnalysis();
  const queryClient = useQueryClient();
  const { guard } = useSubmitGuard();
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  // Session-scoped dismissal for the "yesterday under-logged" prompt. FeedArea
  // stays mounted across date navigation, so this survives clicking through to
  // yesterday and back; a hard reload re-arms the once-daily nudge.
  const [yesterdayPromptDismissed, setYesterdayPromptDismissed] =
    useState(false);

  const lastPrefilledMealRef = useRef<string | null>(null);
  // Cheat-meal mode: a buffet/indulgent occasion logged via sliders.
  const [isCheat, setIsCheat] = useState(false);
  // Indulgence magnitude (like an AI "thinking" level) — scales the estimate.
  const [cheatIntensity, setCheatIntensity] =
    useState<CheatIntensity>('medium');
  // "Log it again" — re-staging a past cheat occasion (a quick DB insert, no AI).
  const [isStagingRepeat, setIsStagingRepeat] = useState(false);
  const recentCheatOccasions = useRecentCheatOccasions(profile.userId, isCheat);

  // Prefill from dashboard meal trigger; re-runs when initialMeal changes so
  // repeated dashboard→logging handoffs while the component stays mounted work.
  useEffect(() => {
    if (!initialMeal || lastPrefilledMealRef.current === initialMeal) return;
    lastPrefilledMealRef.current = initialMeal;
    inputRef.current?.setText(initialMeal);
    inputRef.current?.focus();
    onInitialMealApplied?.();
  }, [initialMeal, onInitialMealApplied]);

  const {
    data: loggingDay,
    isError: isDayError,
    isFetching,
    isLoading,
    refetch: refetchLoggingDay,
  } = useLoggingDay(profile.userId, selectedDate);
  const isDayLoading = isLoading || isDateNavigationPending;
  const isDayRetrying = isFetching && !isLoading;
  const persistedMeals = loggingDay?.persistedMeals ?? [];
  const orderedPersistedMeals = useMemo(
    () =>
      persistedMeals.toSorted((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [persistedMeals]
  );
  const pendingConfirmations = loggingDay?.pendingConfirmations ?? [];

  // Mutations
  const confirmMeal = useConfirmMeal(profile.userId);

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

  // Compute daily totals from persisted meals
  const targets = useMemo(
    () => ({
      calories: profile.calorieTarget,
      protein: profile.proteinTargetG,
      carbs: profile.carbsTargetG,
      fat: profile.fatTargetG,
    }),
    [
      profile.calorieTarget,
      profile.proteinTargetG,
      profile.carbsTargetG,
      profile.fatTargetG,
    ]
  );

  const dailyTotals = useMemo(() => {
    if (persistedMeals.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    const total = sumDisplayedNutrition(
      persistedMeals.map((meal) => meal.nutrition)
    );

    return {
      calories: Math.round(total.caloriesKcal ?? 0),
      protein: Math.round(total.proteinG ?? 0),
      carbs: Math.round(total.carbohydrateG ?? 0),
      fat: Math.round(total.fatG ?? 0),
    };
  }, [persistedMeals]);

  const hasUnknownDailyMacros = useMemo(
    () =>
      persistedMeals.some(
        (meal) =>
          meal.nutrition.caloriesKcal == null ||
          meal.nutrition.proteinG == null ||
          meal.nutrition.carbohydrateG == null ||
          meal.nutrition.fatG == null
      ),
    [persistedMeals]
  );

  const lastAnalysisIdRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

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

  const handleAnalysisComplete = useCallback(() => {
    const originDate =
      messages.find((message) => message.id === streamingMsgId)?.loggedDate ??
      selectedDate;

    // byUserDate is a 3-element key; the actual query uses byUserDateOffset
    // (4 elements, including the tz offset). This relies on TanStack Query's
    // default prefix matching to invalidate it — do not add `exact: true` here
    // or the yesterday-prompt/day view will show stale totals after a re-log.
    //
    // refetchType: 'none' marks the day stale WITHOUT launching a background
    // refetch. The pending card already renders from the local streamed
    // message, so no immediate network read is needed here — and that refetch
    // (which captures the pre-save snapshot) could otherwise resolve after a
    // confirm and clobber the just-saved meal, leaving the calorie ring stale.
    // The confirm mutation's onSettled refetch reconciles authoritative state.
    queryClient.invalidateQueries({
      queryKey: loggingDayKeys.byUserDate(profile.userId, originDate),
      refetchType: 'none',
    });
    queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
  }, [messages, profile.userId, queryClient, selectedDate, streamingMsgId]);

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

  const handleConfirmMeal = (
    messageId: string,
    analysisId: string,
    edits: MealQuantityEdit[]
  ) => {
    // Capture the streamed analysis off the local message BEFORE we drop it, so
    // the optimistic cache update can build the meal from data we already hold
    // instead of depending on the pending-confirmation row being in the cache.
    const message = messages.find(
      (m) => m.id === messageId || m.analysisId === analysisId
    );
    // Drop the local copy before mutate so the optimistic cache update in
    // useConfirmMeal does not briefly expose it as an unsaved card.
    setMessages((prev) =>
      prev.filter((m) => m.id !== messageId && m.analysisId !== analysisId)
    );
    if (!message?.parsedMeal) return;
    // Client-minted id: doubles as the persisted row's PK and an idempotency
    // key, so the optimistic card and the refetched row share one stable React
    // key (no remount/re-fade after save).
    const mealId = crypto.randomUUID();
    confirmMeal.mutate(
      {
        analysisId,
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
        },
      }
    );
  };

  const handleConfirmCheatMeal = (
    messageId: string,
    analysisId: string,
    levels: CheatSliderLevels
  ) => {
    const message = messages.find(
      (m) => m.id === messageId || m.analysisId === analysisId
    );
    setMessages((prev) =>
      prev.filter((m) => m.id !== messageId && m.analysisId !== analysisId)
    );
    if (!message?.cheatSpec) return;
    const mealId = crypto.randomUUID();
    confirmMeal.mutate(
      {
        analysisId,
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
  const handleCheatClarify = (messageId: string, answer: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    setStreamingMsgId(messageId);
    lastAnalysisIdRef.current = null;
    lastErrorRef.current = null;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              cheatSpec: undefined,
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
      mode: 'cheat',
      cheatIntensity,
      clarifyAnswer: answer,
    });
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

  // Derive display messages: overlay live streaming state onto the active message.
  const displayMessages = useMemo(() => {
    const selectedMessages = messages.filter(
      (message) => message.loggedDate === selectedDate
    );

    if (!streamingMsgId || stream.status === 'idle') return selectedMessages;

    return selectedMessages.map((msg) => {
      if (msg.id !== streamingMsgId) return msg;
      return {
        ...msg,
        isStreaming: true,
        streamingPhase: toStreamingPhase(stream.status),
        streamingItems:
          stream.items.length > 0 ? stream.items : msg.streamingItems,
        streamingCompletedItems:
          stream.completedItems.length > 0
            ? stream.completedItems
            : msg.streamingCompletedItems,
      };
    });
  }, [
    messages,
    selectedDate,
    streamingMsgId,
    stream.status,
    stream.items,
    stream.completedItems,
  ]);

  // Auto-scroll when streaming card grows
  const streamItemCount = stream.items.length + stream.completedItems.length;
  useEffect(() => {
    if (stream.isAnalyzing && streamItemCount > 0) {
      scrollToBottom();
    }
  }, [stream.isAnalyzing, streamItemCount, scrollToBottom]);

  // Unconfirmed streaming messages (exclude user messages)
  const pendingIds = useMemo(
    () => new Set(pendingConfirmations.map((pending) => pending.id)),
    [pendingConfirmations]
  );

  const pendingMessages = useMemo<ChatMessage[]>(
    () =>
      pendingConfirmations.map((pending) => ({
        id: `pending-${pending.id}`,
        role: 'assistant',
        content: '',
        parsedMeal: pending.parsedMeal,
        cheatSpec: pending.cheatSpec,
        userInput: pending.rawInput,
        timestamp: new Date(pending.loggedAt),
        loggedDate: selectedDate,
        analysisId: pending.id,
      })),
    [pendingConfirmations, selectedDate]
  );

  const unconfirmedMessages = [
    ...pendingMessages,
    ...displayMessages.filter(
      (m) =>
        m.role === 'assistant' &&
        (!m.analysisId || !pendingIds.has(m.analysisId))
    ),
  ];
  const hasPendingMessages = pendingMessages.length > 0;
  const hasStreamingMessages = unconfirmedMessages.some(
    (message) => !pendingIds.has(message.analysisId ?? '')
  );
  const hasPersistedMeals = persistedMeals.length > 0;
  const hasContent =
    hasPersistedMeals || hasPendingMessages || hasStreamingMessages;

  const isToday = selectedDate === today;
  const isPastDay = selectedDate < today;
  const showPartialDayNotice =
    isPastDay &&
    !isDayLoading &&
    !isDayError &&
    !hasUnknownDailyMacros &&
    hasPersistedMeals &&
    !hasPendingMessages &&
    !hasStreamingMessages &&
    isLikelyPartialDay(dailyTotals.calories, profile.calorieTarget);

  return (
    <main className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden">
      {isToday && !yesterdayPromptDismissed && (
        <PartialYesterdayPrompt
          userId={profile.userId}
          yesterday={addDays(today, -1)}
          calorieTarget={profile.calorieTarget}
          onOpenDay={onSelectDate}
          onDismiss={() => setYesterdayPromptDismissed(true)}
        />
      )}

      <div
        className="shrink-0 bg-nham-surface px-3 pt-3 pb-2 sm:px-6 sm:pt-4 sm:pb-3"
        data-testid="macro-summary-region"
      >
        <div className="mx-auto max-w-4xl">
          {isDayLoading ? (
            <MacroSummarySkeleton />
          ) : isDayError ? null : hasUnknownDailyMacros ? (
            <div
              className="font-medium text-[11px] text-nham-text-muted/80"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('legacyMacroWarning')}
            </div>
          ) : (
            <MacroSummary totals={dailyTotals} targets={targets} />
          )}
        </div>
      </div>

      {showPartialDayNotice && (
        <div className="shrink-0 px-3 pb-2 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <PartialDayNotice
              calories={dailyTotals.calories}
              target={profile.calorieTarget}
            />
          </div>
        </div>
      )}

      {/* Scrollable meal cards only */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 sm:py-4"
        data-testid="meal-card-scroll"
      >
        <AnimatePresence mode="wait">
          {!hasContent &&
            !stream.isAnalyzing &&
            !isDayLoading &&
            !isDayError && (
              <div className="flex flex-1 items-center justify-center py-6">
                <EmptyState
                  onSuggestionClick={(suggestion) => {
                    inputRef.current?.setText(suggestion);
                    inputRef.current?.focus();
                  }}
                />
              </div>
            )}
        </AnimatePresence>

        {isDayLoading && <LoggingDaySkeleton />}

        {!isDayLoading && isDayError && (
          <LoggingDayErrorState
            isRetrying={isDayRetrying}
            onRetry={() => {
              void refetchLoggingDay();
            }}
          />
        )}

        {!isDayLoading && !isDayError && hasContent && (
          <div className="mx-auto w-full max-w-3xl pl-6 sm:pl-12">
            <div className="flex flex-col gap-5 sm:gap-8">
              {/* Persisted meals from DB */}
              <AnimatePresence initial={false}>
                {orderedPersistedMeals.map((meal) => (
                  <PersistedMealCard key={meal.id} meal={meal} />
                ))}
              </AnimatePresence>

              {/* Streaming / unconfirmed messages */}
              <AnimatePresence initial={false}>
                {unconfirmedMessages.map((msg) => {
                  if (msg.isStreaming) {
                    return <StreamingMealEntry key={msg.id} message={msg} />;
                  }

                  if (msg.cheatSpec) {
                    return (
                      <CheatSliderCard
                        key={msg.id}
                        spec={msg.cheatSpec}
                        userInput={msg.userInput}
                        timestamp={msg.timestamp}
                        isConfirming={confirmMeal.isPending}
                        onConfirm={(levels) => {
                          if (msg.analysisId)
                            handleConfirmCheatMeal(
                              msg.id,
                              msg.analysisId,
                              levels
                            );
                        }}
                        onClarify={(answer) =>
                          handleCheatClarify(msg.id, answer)
                        }
                      />
                    );
                  }

                  if (msg.parsedMeal) {
                    return (
                      <MealEntry
                        key={msg.id}
                        message={msg}
                        isConfirming={confirmMeal.isPending}
                        onConfirm={(edits) => {
                          if (msg.analysisId)
                            handleConfirmMeal(msg.id, msg.analysisId, edits);
                        }}
                      />
                    );
                  }

                  // Error message display
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative"
                    >
                      <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
                      <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-rose-400 bg-white" />
                      <div className="rounded-2xl border border-rose-200/60 bg-rose-50/50 p-4">
                        {msg.userInput && (
                          <p
                            className="mb-2 text-[13px] text-nham-text-muted"
                            style={{ fontFamily: 'Lora, serif' }}
                          >
                            {msg.userInput}
                          </p>
                        )}
                        <p
                          className="text-rose-600 text-sm"
                          style={{
                            fontFamily: 'DM Sans, sans-serif',
                          }}
                        >
                          {msg.content}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-3 pt-2 pb-3 sm:px-6 sm:pb-4">
        {isCheat && (
          <CheatOccasionChips
            occasions={recentCheatOccasions.data ?? []}
            disabled={isStagingRepeat || stream.isAnalyzing}
            onSelect={handleRepeatCheat}
          />
        )}
        <div className="mx-auto max-w-3xl">
          <MealInput
            ref={inputRef}
            onSubmit={handleSubmit}
            onCancel={() => {
              stream.cancel();
              if (streamingMsgId) {
                setMessages((prev) =>
                  prev.filter((m) => m.id !== streamingMsgId)
                );
              }
              setStreamingMsgId(null);
            }}
            disabled={stream.isAnalyzing}
            isCheat={isCheat}
            onToggleCheat={setIsCheat}
            cheatIntensity={cheatIntensity}
            onChangeIntensity={setCheatIntensity}
          />
        </div>
      </div>
    </main>
  );
}
