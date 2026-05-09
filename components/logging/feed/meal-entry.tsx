'use client';

import { ChevronDown, Pencil, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { MealEntryActions } from '@/components/logging/feed/meal-entry-actions';
import { MealEntryItem } from '@/components/logging/feed/meal-entry-item';
import { applyQuantityChange, recalculateTotals } from '@/lib/meal-utils';
import type { ChatMessage, MealItem } from '@/lib/types/meal';

interface MealEntryProps {
  message: ChatMessage;
  onConfirm?: () => void;
  isConfirming?: boolean;
}

export function MealEntry({
  message,
  onConfirm,
  isConfirming: _isConfirming,
}: MealEntryProps) {
  const t = useTranslations('logging.mealEntry');
  const tc = useTranslations('common');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [savedItems, setSavedItems] = useState<MealItem[]>(
    message.parsedMeal?.items ?? []
  );
  const [editedItems, setEditedItems] = useState<MealItem[]>(
    message.parsedMeal?.items ?? []
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  const meal = message.parsedMeal;
  if (!meal) return null;

  const currentItems = isEditing ? editedItems : savedItems;
  const currentTotals = recalculateTotals(currentItems);

  const handleQuantityChange = (itemId: string, delta: number) => {
    setEditedItems((prev) =>
      applyQuantityChange(prev, meal.items, itemId, delta)
    );
  };

  const handleEdit = () => {
    setEditedItems([...savedItems]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedItems(savedItems);
  };

  const handleSaveEdit = () => {
    setSavedItems(editedItems);
    setIsEditing(false);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    setIsEditing(false);
    setIsCollapsed(true);
    onConfirm?.();
  };

  const timeLabel = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
      <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-accent bg-white" />

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
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header: quoted input + controls */}
        <div className="flex items-start justify-between gap-3">
          {message.userInput && (
            <p
              className="text-[17px] text-nham-text leading-relaxed"
              style={{ fontFamily: 'Lora, serif' }}
            >
              &ldquo;{message.userInput}&rdquo;
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
            {!confirmed && (
              <AnimatePresence mode="wait" initial={false}>
                {isEditing ? (
                  <motion.button
                    key="cancel"
                    type="button"
                    onClick={handleCancelEdit}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5 rounded-full border border-rose-200/60 bg-rose-50/60 px-2.5 py-1 text-rose-500 transition-colors hover:border-rose-300/60 hover:bg-rose-50"
                  >
                    <X className="h-3 w-3" />
                    <span
                      className="font-medium text-[10px]"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {tc('cancel')}
                    </span>
                  </motion.button>
                ) : (
                  <motion.button
                    key="edit"
                    type="button"
                    onClick={handleEdit}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5 rounded-full border border-nham-border/50 px-2.5 py-1 text-nham-text-muted transition-colors hover:border-nham-accent/50 hover:bg-nham-hover/40 hover:text-nham-text"
                  >
                    <Pencil className="h-3 w-3" />
                    <span
                      className="font-medium text-[10px]"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {t('edit')}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
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
              className="mt-2 flex items-center justify-between"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
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
              <div className="mt-5 border-nham-border border-t border-dashed pt-4">
                {/* Items list */}
                <div className="mb-4 space-y-1">
                  {currentItems.map((item, idx) => (
                    <MealEntryItem
                      key={item.id}
                      item={item}
                      index={idx}
                      isEditing={isEditing}
                      onQuantityChange={handleQuantityChange}
                    />
                  ))}
                </div>

                {/* Totals — flat, no card */}
                <div className="border-nham-border/50 border-t border-dashed pt-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-[13px] text-nham-text"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {t('total')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span
                        className="text-[11px] text-nham-text-muted tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        P: {Math.round(currentTotals.protein)}g{'  '}C:{' '}
                        {Math.round(currentTotals.carbs)}g{'  '}F:{' '}
                        {Math.round(currentTotals.fat)}g
                      </span>
                      <span
                        className="font-bold text-nham-text tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
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
          onCancel={handleCancelEdit}
          onSave={handleSaveEdit}
          onConfirm={handleConfirm}
        />
      )}
    </motion.article>
  );
}
