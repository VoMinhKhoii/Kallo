'use client';

import { Check, ChevronDown, Pencil } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { MealEntryActions } from '@/components/logging/feed/meal-entry/meal-entry-actions';
import { MealEntryItem } from '@/components/logging/feed/meal-entry/meal-entry-item';
import { PortionPicker } from '@/components/logging/feed/meal-entry/portion/portion-picker';
import { TurnHeader } from '@/components/logging/feed/turn-header';
import {
  applyQuantityChange,
  deriveQuantityEdits,
  recalculateTotals,
} from '@/lib/meal-utils';
import type { ChatMessage, MealItem, MealQuantityEdit } from '@/lib/types/meal';

// Briefly block Confirm after a quantity tap so a fast double-tap on a
// stepper can't slip through and save before the user is done adjusting.
const CONFIRM_DEBOUNCE_MS = 300;

interface MealEntryProps {
  message: ChatMessage;
  onConfirm?: (edits: MealQuantityEdit[]) => void;
  // Disables the confirm action while a save is in flight, so a fast
  // double-click can't dispatch two saves (two mealIds → two inserts).
  isConfirming?: boolean;
  /** The answer to a run just watched: it takes over in place, not enters. */
  revealing?: boolean;
}

export function MealEntry({
  message,
  onConfirm,
  isConfirming,
  revealing = false,
}: MealEntryProps) {
  const t = useTranslations('logging.mealEntry');
  const locale = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [items, setItems] = useState<MealItem[]>(
    message.parsedMeal?.items ?? []
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [confirmCoolingDown, setConfirmCoolingDown] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const meal = message.parsedMeal;
  if (!meal) return null;

  const currentTotals = recalculateTotals(items);

  // Edits apply live to `items` — no separate save step. Quantities scale
  // against the original AI estimate so repeated +/- stays proportional.
  const handleQuantityChange = (itemId: string, delta: number) => {
    setItems((prev) => applyQuantityChange(prev, meal.items, itemId, delta));
    setConfirmCoolingDown(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(
      () => setConfirmCoolingDown(false),
      CONFIRM_DEBOUNCE_MS
    );
  };

  const handleConfirm = () => {
    const edits = deriveQuantityEdits(items, meal.items);
    setConfirmed(true);
    setIsEditing(false);
    setIsCollapsed(true);
    onConfirm?.(edits);
  };

  const timeLabel = message.timestamp.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.article
      // A CONTINUATION, not an arrival: the message and dishes were on screen
      // a frame ago, so fading the block in blinks what was being read.
      initial={revealing ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative"
    >
      <TurnHeader timeLabel={timeLabel} message={message.userInput} />

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header: quoted input + controls */}
        <div className="flex items-start justify-between gap-3">
          {message.userInput && (
            <p className="font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
              {message.userInput}
            </p>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {confirmed && (
              <button
                type="button"
                aria-label={t('toggleDetails')}
                aria-expanded={!isCollapsed}
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="rounded-full p-1 text-nham-text-muted/60 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                />
              </button>
            )}
            {/* One button whose face swaps in place — a mode="wait" morph here
                left a beat with no button at all. */}
            {!confirmed && (
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className={
                  isEditing
                    ? 'flex items-center gap-1.5 rounded-full border border-nham-border bg-nham-hover px-2.5 py-1 text-nham-text transition-colors hover:bg-nham-hover/70'
                    : 'flex items-center gap-1.5 rounded-full border border-nham-border/50 px-2.5 py-1 text-nham-text-muted transition-colors hover:border-nham-accent/50 hover:bg-nham-hover/40 hover:text-nham-text'
                }
              >
                {isEditing ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Pencil className="h-3 w-3" />
                )}
                <span
                  className={
                    isEditing
                      ? 'font-sans-display font-semibold text-[10px]'
                      : 'font-medium font-sans-display text-[10px]'
                  }
                >
                  {isEditing ? t('done') : t('edit')}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsed summary */}
        <AnimatePresence initial={false}>
          {confirmed && isCollapsed && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 flex items-center justify-between font-sans-display"
            >
              <span className="text-[11px] text-nham-text-muted tabular-nums">
                P: {Math.round(currentTotals.protein)}g{'  '}C:{' '}
                {Math.round(currentTotals.carbs)}g{'  '}F:{' '}
                {Math.round(currentTotals.fat)}g
              </span>
              <span className="font-bold text-nham-text text-sm tabular-nums">
                {Math.round(currentTotals.calories)} kcal
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expandable details */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-5 border-nham-border border-t pt-4">
                {/* Items list */}
                <div className="mb-4 space-y-1">
                  {items.map((item, idx) => (
                    <div key={item.id}>
                      <MealEntryItem
                        item={item}
                        index={idx}
                        isEditing={isEditing}
                        onQuantityChange={handleQuantityChange}
                      />
                      {!confirmed && item.vessel && (
                        <PortionPicker
                          item={item}
                          items={items}
                          onApply={setItems}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Totals — flat, no card */}
                <div className="border-nham-border/50 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-sans-display text-[13px] text-nham-text">
                      {t('total')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-sans-display text-[11px] text-nham-text-muted tabular-nums">
                        P: {Math.round(currentTotals.protein)}g{'  '}C:{' '}
                        {Math.round(currentTotals.carbs)}g{'  '}F:{' '}
                        {Math.round(currentTotals.fat)}g
                      </span>
                      <span className="font-bold font-sans-display text-nham-text tabular-nums">
                        {Math.round(currentTotals.calories)} kcal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      {!confirmed && (
        <MealEntryActions
          isEditing={isEditing}
          disabled={isConfirming || (isEditing && confirmCoolingDown)}
          onConfirm={handleConfirm}
        />
      )}
    </motion.article>
  );
}
