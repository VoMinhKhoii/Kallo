'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/logging/feed/empty-state';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { MealEntry } from '@/components/logging/feed/meal-entry';
import { AnalysisStageBanner } from '@/components/logging/feed/skeletons';
import { MealInput } from '@/components/logging/input/meal-input';
import { useStreamAnalysis } from '@/hooks/use-stream-analysis';
import { recalculateTotals } from '@/lib/meal-utils';
import type { ChatMessage, MacroBreakdown, ParsedMeal } from '@/lib/types/meal';

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface FeedAreaProps {
  targets: MacroBreakdown;
}

export function FeedArea({ targets }: FeedAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const stream = useStreamAnalysis();

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

  const dailyTotals = useMemo<MacroBreakdown>(() => {
    const meals = messages
      .filter((m) => m.role === 'assistant' && m.parsedMeal)
      .map((m) => m.parsedMeal!);

    return meals.reduce<MacroBreakdown>(
      (acc, meal) => {
        const totals = recalculateTotals(meal.items);
        return {
          calories: acc.calories + totals.calories,
          protein: acc.protein + totals.protein,
          carbs: acc.carbs + totals.carbs,
          fat: acc.fat + totals.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [messages]);

  const handleSubmit = async () => {
    const text = inputValue.trim();
    if (!text || stream.isAnalyzing) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    scrollToBottom();

    await stream.analyze(text);
  };

  // When stream completes with a result, append it as a message
  const lastAnalysisIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      stream.status !== 'done' ||
      !stream.result ||
      !stream.analysisId ||
      lastAnalysisIdRef.current === stream.analysisId
    ) {
      return;
    }
    lastAnalysisIdRef.current = stream.analysisId;

    setMessages((prev) => {
      const lastUserMsg = [...prev].reverse().find((m) => m.role === 'user');
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        parsedMeal: stream.result!,
        userInput: lastUserMsg?.content,
        timestamp: new Date(),
      };
      return [...prev, assistantMessage];
    });
    stream.reset();
    scrollToBottom();
  }, [
    stream.status,
    stream.result,
    stream.analysisId,
    stream.reset,
    scrollToBottom,
  ]);

  // When stream errors, show toast and append error message
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      stream.status !== 'error' ||
      !stream.error ||
      lastErrorRef.current === stream.error
    ) {
      return;
    }
    lastErrorRef.current = stream.error;

    toast.error(stream.error);

    setMessages((prev) => {
      const lastUserMsg = [...prev].reverse().find((m) => m.role === 'user');
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: stream.error!,
        userInput: lastUserMsg?.content,
        timestamp: new Date(),
      };
      return [...prev, errorMessage];
    });
    stream.reset();
    scrollToBottom();
  }, [stream.status, stream.error, stream.reset, scrollToBottom]);

  const handleConfirmMeal = (messageId: string, meal: ParsedMeal) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, parsedMeal: meal } : msg
      )
    );
  };

  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const hasMessages = assistantMessages.length > 0;

  return (
    <main className="flex flex-1 flex-col self-stretch overflow-hidden">
      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <AnimatePresence mode="wait">
          {!hasMessages && !stream.isAnalyzing && (
            <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
              <EmptyState onSuggestionClick={setInputValue} />
            </div>
          )}
        </AnimatePresence>

        {(hasMessages || stream.isAnalyzing) && (
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
                  <AnimatePresence initial={false}>
                    {assistantMessages.map((msg) => {
                      if (msg.parsedMeal) {
                        return (
                          <MealEntry
                            key={msg.id}
                            message={msg}
                            onConfirm={(meal) =>
                              handleConfirmMeal(msg.id, meal)
                            }
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

                  {/* Streaming stage indicator */}
                  <AnimatePresence>
                    {stream.isAnalyzing && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        <AnalysisStageBanner
                          status={stream.status}
                          items={stream.items}
                        />
                      </motion.div>
                    )}
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
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={stream.isAnalyzing}
          />
        </div>
      </div>
    </main>
  );
}
