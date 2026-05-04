'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/logging/feed/empty-state';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { MealEntry } from '@/components/logging/feed/meal-entry';
import { PersistedMealCard } from '@/components/logging/feed/persisted-meal-card';
import { StreamingMealEntry } from '@/components/logging/feed/streaming-meal-entry';
import {
  MealInput,
  type MealInputHandle,
} from '@/components/logging/input/meal-input';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import { useFeedSubmit } from '@/hooks/use-feed-submit';
import { loggingDayKeys, useLoggingDay } from '@/hooks/use-logging-day';
import { useConfirmMeal } from '@/hooks/use-meal-mutations';
import { useStreamAnalysis } from '@/hooks/use-stream-analysis';
import { useStreamingTerminalEffects } from '@/hooks/use-streaming-terminal-effects';
import { useSubmitGuard } from '@/hooks/use-submit-guard';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import type { ChatMessage, StreamingPhase } from '@/lib/types/meal';

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
  profile: LoggingProfile;
  initialMeal?: string;
  isDateNavigationPending?: boolean;
  onInitialMealApplied?: () => void;
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
      className="mx-auto w-full max-w-3xl pl-10 sm:pl-12"
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

export function FeedArea({
  selectedDate,
  profile,
  initialMeal,
  isDateNavigationPending = false,
  onInitialMealApplied,
}: FeedAreaProps) {
  const t = useTranslations('logging.feedArea');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<MealInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stream = useStreamAnalysis();
  const queryClient = useQueryClient();
  const { guard } = useSubmitGuard();
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  const lastPrefilledMealRef = useRef<string | null>(null);

  // Prefill from dashboard meal trigger; re-runs when initialMeal changes so
  // repeated dashboard→logging handoffs while the component stays mounted work.
  useEffect(() => {
    if (!initialMeal || lastPrefilledMealRef.current === initialMeal) return;
    lastPrefilledMealRef.current = initialMeal;
    inputRef.current?.setText(initialMeal);
    inputRef.current?.focus();
    onInitialMealApplied?.();
  }, [initialMeal, onInitialMealApplied]);

  const { data: loggingDay, isLoading } = useLoggingDay(
    profile.userId,
    selectedDate
  );
  const isDayLoading = isLoading || isDateNavigationPending;
  const persistedMeals = loggingDay?.persistedMeals ?? [];
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
  });

  const handleAnalysisComplete = useCallback(() => {
    const originDate =
      messages.find((message) => message.id === streamingMsgId)?.loggedDate ??
      selectedDate;

    queryClient.invalidateQueries({
      queryKey: loggingDayKeys.byUserDate(profile.userId, originDate),
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

  // Handle confirm: persist to DB, remove streaming message
  const handleConfirmMeal = (messageId: string, analysisId: string) => {
    confirmMeal.mutate(
      { analysisId, originDate: selectedDate },
      {
        onSuccess: () => {
          // Remove the streaming message — persisted meal will appear via query
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
          toast.success(t('savedMeal'));
        },
      }
    );
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

  return (
    <main className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden">
      <div
        className="shrink-0 bg-nham-surface px-4 pt-4 pb-3 sm:px-6"
        data-testid="macro-summary-region"
      >
        <div className="mx-auto max-w-4xl">
          {isDayLoading ? (
            <MacroSummarySkeleton />
          ) : hasUnknownDailyMacros ? (
            <div
              className="font-medium text-[11px] text-nham-text-muted/80"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Daily macro summary unavailable because some legacy meals have
              unknown macros.
            </div>
          ) : (
            <MacroSummary totals={dailyTotals} targets={targets} />
          )}
        </div>
      </div>

      {/* Scrollable meal cards only */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-testid="meal-card-scroll"
      >
        <AnimatePresence mode="wait">
          {!hasContent && !stream.isAnalyzing && !isDayLoading && (
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

        {!isDayLoading && hasContent && (
          <div className="mx-auto w-full max-w-3xl pl-10 sm:pl-12">
            <div className="flex flex-col gap-8">
              {/* Persisted meals from DB */}
              <AnimatePresence initial={false}>
                {persistedMeals.map((meal) => (
                  <PersistedMealCard key={meal.id} meal={meal} />
                ))}
              </AnimatePresence>

              {/* Streaming / unconfirmed messages */}
              <AnimatePresence initial={false}>
                {unconfirmedMessages.map((msg) => {
                  if (msg.isStreaming) {
                    return <StreamingMealEntry key={msg.id} message={msg} />;
                  }

                  if (msg.parsedMeal) {
                    return (
                      <MealEntry
                        key={msg.id}
                        message={msg}
                        onConfirm={() => {
                          if (msg.analysisId)
                            handleConfirmMeal(msg.id, msg.analysisId);
                        }}
                        isConfirming={confirmMeal.isPending}
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
                            &ldquo;{msg.userInput}&rdquo;
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
      <div className="shrink-0 px-4 sm:px-6 pt-2 pb-4">
        <div className="mx-auto max-w-3xl">
          <MealInput
            ref={inputRef}
            onSubmit={handleSubmit}
            disabled={stream.isAnalyzing}
          />
        </div>
      </div>
    </main>
  );
}
