'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/logging/feed/empty-state';
import { MacroSummary } from '@/components/logging/feed/macro-summary';
import { MealEntry } from '@/components/logging/feed/meal-entry';
import { MealInput } from '@/components/logging/input/meal-input';
import { useAnalyzeMeal } from '@/hooks/use-analyze-meal';
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
  const { mutateAsync, isPending } = useAnalyzeMeal();

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
    if (!text || isPending) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    scrollToBottom();

    try {
      const parsedMeal: ParsedMeal = await mutateAsync(text);

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        parsedMeal,
        userInput: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      scrollToBottom();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to analyze meal. Please try again.';
      toast.error(message);

      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: message,
        userInput: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      scrollToBottom();
    }
  };

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
          {!hasMessages && !isPending && (
            <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
              <EmptyState onSuggestionClick={setInputValue} />
            </div>
          )}
        </AnimatePresence>

        {(hasMessages || isPending) && (
          <>
            {/* Sticky macro summary */}
            <div className="sticky top-0 z-10 bg-[#FEFBF6] px-4 pt-4 pb-3 sm:px-6">
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
                          <div className="absolute top-2 bottom-0 -left-10 w-px bg-[#E8D5B5]/60 group-last:bg-transparent" />
                          <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-rose-400 bg-white" />
                          <div className="rounded-2xl border border-rose-200/60 bg-rose-50/50 p-4">
                            {msg.userInput && (
                              <p
                                className="mb-2 text-[#8B7355] text-[13px]"
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

                  {/* Loading indicator */}
                  <AnimatePresence>
                    {isPending && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="group relative"
                      >
                        <div className="absolute top-2 bottom-0 -left-10 w-px bg-[#E8D5B5]/60 group-last:bg-transparent" />
                        <div className="absolute top-2 -left-[43px] h-2 w-2 animate-pulse rounded-full border-2 border-[#C9A87C] bg-[#C9A87C]/30" />
                        <div className="flex items-center gap-2.5 rounded-2xl border border-[#E8D5B5]/30 bg-white px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-[#C9A87C]" />
                          <span
                            className="text-[#8B7355] text-sm"
                            style={{
                              fontFamily: 'DM Sans, sans-serif',
                            }}
                          >
                            Analyzing your meal...
                          </span>
                        </div>
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
            disabled={isPending}
          />
        </div>
      </div>
    </main>
  );
}
