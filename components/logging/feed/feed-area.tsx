'use client';

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
import { useDailyMeals } from '@/hooks/use-daily-meals';
import { useFeedSubmit } from '@/hooks/use-feed-submit';
import { useConfirmMeal } from '@/hooks/use-meal-mutations';
import { useStreamAnalysis } from '@/hooks/use-stream-analysis';
import { useStreamingTerminalEffects } from '@/hooks/use-streaming-terminal-effects';
import { useSubmitGuard } from '@/hooks/use-submit-guard';
import {
  goalAdjustNutrition,
  sumDisplayedNutrition,
} from '@/lib/ai/pipeline/goal-adjustment';
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
}

export function FeedArea({
  selectedDate,
  profile,
  initialMeal,
}: FeedAreaProps) {
  const t = useTranslations('logging.feedArea');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<MealInputHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stream = useStreamAnalysis();
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
  }, [initialMeal]);

  // Persisted meals from DB
  const { data: persistedMeals = [], isLoading } = useDailyMeals(selectedDate);

  // Mutations
  const confirmMeal = useConfirmMeal();

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

  // Compute daily totals from persisted meals using goal adjustment
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

    const displayed = persistedMeals.map((meal) =>
      goalAdjustNutrition(
        meal.boundedNutrition,
        profile.goal,
        profile.aggression
      )
    );
    const total = sumDisplayedNutrition(displayed);

    return {
      calories: Math.round(total.caloriesKcal ?? 0),
      protein: Math.round(total.proteinG ?? 0),
      carbs: Math.round(total.carbohydrateG ?? 0),
      fat: Math.round(total.fatG ?? 0),
    };
  }, [persistedMeals, profile.goal, profile.aggression]);

  const lastAnalysisIdRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const { handleSubmit } = useFeedSubmit({
    stream,
    inputRef,
    setMessages,
    setStreamingMsgId,
    scrollToBottom,
    guard,
    lastAnalysisIdRef,
    lastErrorRef,
  });

  useStreamingTerminalEffects({
    stream,
    streamingMsgId,
    setStreamingMsgId,
    setMessages,
    scrollToBottom,
    lastAnalysisIdRef,
    lastErrorRef,
  });

  // Handle confirm: persist to DB, remove streaming message
  const handleConfirmMeal = (messageId: string, analysisId: string) => {
    confirmMeal.mutate(
      { analysisId },
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
    if (!streamingMsgId || stream.status === 'idle') return messages;

    return messages.map((msg) => {
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
  const unconfirmedMessages = displayMessages.filter(
    (m) => m.role === 'assistant'
  );
  const hasPersistedMeals = persistedMeals.length > 0;
  const hasStreamingMessages = unconfirmedMessages.length > 0;
  const hasContent = hasPersistedMeals || hasStreamingMessages;

  return (
    <main className="flex flex-1 flex-col self-stretch overflow-hidden">
      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <AnimatePresence mode="wait">
          {!hasContent && !stream.isAnalyzing && !isLoading && (
            <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
              <EmptyState
                onSuggestionClick={(suggestion) => {
                  inputRef.current?.setText(suggestion);
                  inputRef.current?.focus();
                }}
              />
            </div>
          )}
        </AnimatePresence>

        {hasContent && (
          <>
            {/* Sticky macro summary */}
            <div className="sticky top-0 z-10 bg-nham-surface px-4 pt-4 pb-3 sm:px-6">
              <div className="mx-auto max-w-4xl">
                <MacroSummary totals={dailyTotals} targets={targets} />
              </div>
            </div>

            {/* Meal entries */}
            <div className="px-4 pb-6 sm:px-6">
              <div className="mx-auto w-full max-w-3xl pl-12">
                <div className="flex flex-col gap-8">
                  {/* Persisted meals from DB */}
                  <AnimatePresence initial={false}>
                    {persistedMeals.map((meal) => (
                      <PersistedMealCard
                        key={meal.id}
                        meal={meal}
                        profile={profile}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Streaming / unconfirmed messages */}
                  <AnimatePresence initial={false}>
                    {unconfirmedMessages.map((msg) => {
                      if (msg.isStreaming) {
                        return (
                          <StreamingMealEntry key={msg.id} message={msg} />
                        );
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
            </div>
          </>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pt-2 pb-4">
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
