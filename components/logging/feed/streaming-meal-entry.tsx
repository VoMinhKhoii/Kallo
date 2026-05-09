'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import {
  MealEntryItemSkeleton,
  MealEntryTotalSkeleton,
} from '@/components/logging/feed/skeletons';
import { getStreamingPhaseLabel } from '@/components/logging/feed/streaming-phase-label';
import type { ChatMessage, MealItem } from '@/lib/types/meal';

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
      className="flex items-center justify-between py-2.5 text-[13px]"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <span className="min-w-0 truncate font-medium text-nham-text">
        {item.name}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex gap-2 text-[10px] text-nham-text-muted tabular-nums">
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
        <span className="whitespace-nowrap text-right font-bold text-nham-text tabular-nums">
          {formatCaloriesValue(item.macros.calories)}
        </span>
      </div>
    </motion.div>
  );
}

export function StreamingMealEntry({ message }: StreamingMealEntryProps) {
  const t = useTranslations('logging.streaming');
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

  const timeLabel = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
      <div className="absolute top-2 -left-[43px] h-2 w-2 animate-pulse rounded-full border-2 border-nham-accent bg-nham-accent/30" />

      {/* Time label */}
      <div className="mb-2">
        <span
          className="font-bold text-[11px] text-nham-text-muted/60 tracking-widest"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {timeLabel}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-nham-surface p-4 shadow-sm sm:p-5">
        {/* Header: quoted input */}
        {message.userInput && (
          <p
            className="text-[17px] text-nham-text leading-relaxed"
            style={{ fontFamily: 'Lora, serif' }}
          >
            &ldquo;{message.userInput}&rdquo;
          </p>
        )}

        {/* Streaming content */}
        <div className="mt-5 border-nham-border border-t border-dashed pt-4">
          <div className="mb-4 space-y-1">
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

          {/* Totals skeleton */}
          <MealEntryTotalSkeleton />
        </div>

        {/* Stage indicator. aria-live=polite so screen readers announce
            phase transitions (decompose → match → nutrition → finalize)
            without interrupting whatever is being read. The visible spinner
            is decorative — aria-hidden it so the live region only announces
            the phase text once per change. */}
        <div className="mt-3 flex items-center gap-2">
          <div
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-nham-accent border-t-transparent"
          />
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-[11px] text-nham-text-muted"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {getStreamingPhaseLabel(t, phase)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
