'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAnalyzeMeal } from '@/hooks/use-analyze-meal';
import type { ChatMessage, ParsedMeal } from '@/lib/types/meal';
import { EmptyState } from './empty-state';
import { MealCard } from './meal-card';
import { MealInput } from './meal-input';
import { MessageBubble } from './message-bubble';

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatArea() {
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
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      scrollToBottom();
    }
  };

  const handleConfirmMeal = (_messageId: string, _meal: ParsedMeal) => {
    // In-memory only — persistence comes later
  };

  const hasMessages = messages.length > 0;

  return (
    <main className="flex flex-1 flex-col self-stretch overflow-hidden">
      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-0 py-6"
      >
        <AnimatePresence mode="wait">
          {!hasMessages && <EmptyState onSuggestionClick={setInputValue} />}
        </AnimatePresence>

        {hasMessages && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 350,
                        damping: 30,
                      }}
                    >
                      <MessageBubble message={msg} />
                    </motion.div>
                  );
                }

                if (msg.parsedMeal) {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{
                        opacity: 0,
                        y: 20,
                        scale: 0.95,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 28,
                      }}
                    >
                      <MealCard
                        message={msg}
                        onConfirm={(meal) => handleConfirmMeal(msg.id, meal)}
                      />
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-red-200/60 bg-red-50/80 px-4 py-3">
                      <p
                        className="text-red-700 text-sm"
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

            <AnimatePresence>
              {isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-[#E8D5B5]/30 bg-white px-4 py-3 shadow-sm">
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
