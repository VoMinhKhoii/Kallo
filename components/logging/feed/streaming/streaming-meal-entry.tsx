'use client';

import { motion } from 'motion/react';
import { useLocale } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { MealEntryItemSkeleton } from '@/components/logging/feed/skeletons/meal-entry-item-skeleton';
import { TurnHeader } from '@/components/logging/feed/turn/turn-header';
import { loaderIndexForKey } from '@/components/shared/loaders/registry';
import { StreamTicker } from '@/components/shared/stream-ticker/stream-ticker';
import { deriveStreamTicker } from '@/components/shared/stream-ticker/stream-ticker-frame';
import { formatTime } from '@/lib/core/date/format-time';
import type { ChatMessage, MealItem } from '@/lib/core/types/meal';

const DEFAULT_SKELETON_COUNT = 3;

interface StreamingMealEntryProps {
  message: ChatMessage;
}

/** Read-only meal item row (no edit controls) for streaming display */
function CompletedItemRow({ item, index }: { item: MealItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center justify-between py-2.5 font-sans-display text-[13px]"
    >
      <span className="min-w-0 truncate font-medium text-kallo-text">
        {item.name}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex gap-2 text-[10px] text-kallo-text-muted tabular-nums">
          <span className="whitespace-nowrap text-right">
            P:{formatMacroValue(item.macros.protein)}
          </span>
          <span className="whitespace-nowrap text-right">
            C:{formatMacroValue(item.macros.carbs)}
          </span>
          <span className="whitespace-nowrap text-right">
            F:{formatMacroValue(item.macros.fat)}
          </span>
        </div>
        <span className="whitespace-nowrap text-right font-bold text-kallo-text tabular-nums">
          {formatCaloriesValue(item.macros.calories)}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * A meal mid-analysis: the user's sent message, the ticker holding the loading
 * state, and the dishes landing underneath it.
 *
 * Deliberately CARDLESS. A card is what a finished answer looks like, so
 * drawing one around a half-filled skeleton promised a result that wasn't there
 * yet; the rows sit on the page until the analysis completes and `MealEntry`
 * closes a card around them. The ticker leads rather than trails, so the
 * loading state holds one position for the whole run instead of being pushed
 * down every time a dish lands.
 */
export function StreamingMealEntry({ message }: StreamingMealEntryProps) {
  const locale = useLocale();
  const phase = message.streamingPhase ?? 'waiting';
  const namedItems = message.streamingItems ?? [];
  const completedItems = message.streamingCompletedItems ?? [];

  // Build a set of completed item names (lowercase) for case-insensitive matching
  // Call 1 and Call 2 names come from different LLM calls and may differ in casing
  const completedNamesLower = new Set(
    completedItems.map((i) => i.name.toLowerCase())
  );

  // Named but not yet completed → skeleton with name
  const pendingNames = namedItems.filter(
    (name) => !completedNamesLower.has(name.toLowerCase())
  );

  // Unknown items: skeleton count minus known items
  const totalKnown = completedItems.length + pendingNames.length;
  const anonymousCount = Math.max(0, DEFAULT_SKELETON_COUNT - totalKnown);
  const showAnonymous = phase !== 'assembling' && phase !== 'done';

  const timeLabel = formatTime(message.timestamp, locale);

  const ticker = deriveStreamTicker({
    isAnalyzing: true,
    status: phase,
    items: namedItems,
    completedItems,
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {/* Stamped from the moment of sending, not from when the answer lands —
          the timeline must not wait for the result. */}
      <TurnHeader timeLabel={timeLabel} message={message.userInput} />

      {/* The same horizontal inset the card's content box uses (p-4 sm:p-5), so
          the rows do not slide sideways when `MealEntry` closes a card around
          them at the reveal. */}
      <div className="px-4 sm:px-5">
        {/* One loader for the whole run — hashed off the message id rather than
            held in state, since a loader that changes mid-run reads as a
            restart and the id is already stable for exactly this long. */}
        <StreamTicker
          frame={ticker}
          loaderIndex={loaderIndexForKey(message.id)}
        />

        <div className="mt-2 space-y-1">
          {/* 1. Completed items with real macros (waterfall, top) */}
          {completedItems.map((item, idx) => (
            <CompletedItemRow key={item.id} item={item} index={idx} />
          ))}

          {/* 2. Named but pending items (skeleton with name) */}
          {pendingNames.map((name, idx) => (
            <MealEntryItemSkeleton
              key={name}
              index={completedItems.length + idx}
              name={name}
            />
          ))}

          {/* 3. Anonymous skeletons (for items not yet named) */}
          {showAnonymous &&
            Array.from({ length: anonymousCount }, (_, idx) => (
              <MealEntryItemSkeleton
                key={`skel-${idx}`}
                index={totalKnown + idx}
              />
            ))}
        </div>
      </div>
    </motion.article>
  );
}
