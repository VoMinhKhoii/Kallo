'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CheatSliderCard } from '@/components/logging/feed/cheat/cheat-slider-card';
import { MealEntry } from '@/components/logging/feed/meal-entry/meal-entry';
import {
  type MealAmountEdit,
  PersistedMealCard,
} from '@/components/logging/feed/persisted/persisted-meal-card';
import { StreamingMealEntry } from '@/components/logging/feed/streaming/streaming-meal-entry';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import type { CheatSliderLevels } from '@/lib/types/cheat';
import type { ChatMessage, MealQuantityEdit } from '@/lib/types/meal';

interface FeedCardsProps {
  orderedPersistedMeals: PersistedMeal[];
  unconfirmedMessages: ChatMessage[];
  isConfirming: boolean;
  onDeleteMeal: (mealId: string) => void;
  onLogAgain: (meal: PersistedMeal) => void;
  onUpdateMeal: (mealId: string, changes: MealAmountEdit) => Promise<void>;
  /** Present only while NL-refine is enabled — see REFINE_ENABLED in feed-area. */
  onRefineMeal?: (
    meal: { id: string; rawInput: string; loggedAt: string },
    correction: string
  ) => void;
  onConfirmMeal: (message: ChatMessage, edits: MealQuantityEdit[]) => void;
  onConfirmCheatMeal: (message: ChatMessage, levels: CheatSliderLevels) => void;
  onCheatClarify: (message: ChatMessage, answer: string) => void;
}

/** The day's card stack: persisted meals, then streaming/unconfirmed cards. */
export function FeedCards({
  orderedPersistedMeals,
  unconfirmedMessages,
  isConfirming,
  onDeleteMeal,
  onLogAgain,
  onUpdateMeal,
  onRefineMeal,
  onConfirmMeal,
  onConfirmCheatMeal,
  onCheatClarify,
}: FeedCardsProps) {
  return (
    <div className="mx-auto w-full max-w-3xl pl-6 sm:pl-12">
      <div className="flex flex-col gap-5 sm:gap-8">
        {/* Persisted meals from DB */}
        <AnimatePresence initial={false}>
          {orderedPersistedMeals.map((meal) => (
            <PersistedMealCard
              key={meal.id}
              meal={meal}
              onDelete={() => onDeleteMeal(meal.id)}
              onLogAgain={() => onLogAgain(meal)}
              onUpdate={(changes) => onUpdateMeal(meal.id, changes)}
              onRefine={
                onRefineMeal
                  ? (correction) =>
                      onRefineMeal(
                        {
                          id: meal.id,
                          rawInput: meal.rawInput,
                          loggedAt: meal.loggedAt,
                        },
                        correction
                      )
                  : undefined
              }
            />
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
                  isConfirming={isConfirming}
                  onConfirm={(levels) => onConfirmCheatMeal(msg, levels)}
                  onClarify={(answer) => onCheatClarify(msg, answer)}
                />
              );
            }

            if (msg.parsedMeal) {
              return (
                <MealEntry
                  key={msg.id}
                  message={msg}
                  isConfirming={isConfirming}
                  onConfirm={(edits) => onConfirmMeal(msg, edits)}
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
                <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-danger bg-white" />
                <div className="rounded-2xl border border-nham-danger/30 bg-nham-danger/10 p-4">
                  {msg.userInput && (
                    <p className="mb-2 font-serif text-[13px] text-nham-text-muted">
                      {msg.userInput}
                    </p>
                  )}
                  <p className="font-sans-display text-nham-danger text-sm">
                    {msg.content}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
