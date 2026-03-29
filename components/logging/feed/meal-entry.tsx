'use client';

import { Check, ChefHat, Pencil, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { applyQuantityChange, recalculateTotals } from '@/lib/meal-utils';
import type { ChatMessage, MealItem, ParsedMeal } from '@/lib/types/meal';
import { MealEntryActions } from './meal-entry-actions';
import { MealEntryItem } from './meal-entry-item';

interface MealEntryProps {
  message: ChatMessage;
  onConfirm?: (meal: ParsedMeal) => void;
}

export function MealEntry({ message, onConfirm }: MealEntryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [savedItems, setSavedItems] = useState<MealItem[]>(
    message.parsedMeal?.items ?? []
  );
  const [editedItems, setEditedItems] = useState<MealItem[]>(
    message.parsedMeal?.items ?? []
  );

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
    if (onConfirm) {
      onConfirm({
        ...meal,
        items: savedItems,
        totalMacros: recalculateTotals(savedItems),
      });
    }
  };

  const timeLabel = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-10 w-px bg-[#E8D5B5]/60 group-last:bg-transparent" />
      <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-[#C9A87C] bg-white" />

      {/* Time label */}
      <div className="mb-2">
        <span
          className="font-bold text-[#8B7355]/60 text-[11px] tracking-widest"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {timeLabel}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-[#E8D5B5]/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
        {/* Quoted user input */}
        {message.userInput && (
          <p
            className="mb-5 text-[#2C2416] text-[17px] leading-relaxed"
            style={{ fontFamily: 'Lora, serif' }}
          >
            &ldquo;{message.userInput}&rdquo;
          </p>
        )}

        {/* Extraction divider */}
        <div className="border-[#E8D5B5] border-t border-dashed pt-4">
          {/* Section header with edit toggle */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="h-3.5 w-3.5 text-[#C9A87C]" />
              <span
                className="font-bold text-[#8B7355]/70 text-[10px] uppercase tracking-widest"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                Extracted
              </span>
            </div>

            {/* Edit ↔ Cancel toggle */}
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
                      Cancel
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
                    className="flex items-center gap-1.5 rounded-full border border-[#E8D5B5]/50 px-2.5 py-1 text-[#8B7355] transition-colors hover:border-[#C9A87C]/50 hover:bg-[#F0EAE0]/40 hover:text-[#2C2416]"
                  >
                    <Pencil className="h-3 w-3" />
                    <span
                      className="font-medium text-[10px]"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Edit
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            )}
          </div>

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

          {/* Totals bar */}
          <div className="flex items-center justify-between rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-3">
            <span
              className="font-bold text-[#2C2416] text-[13px]"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Meal Total
            </span>
            <div className="flex items-center gap-4">
              <div className="flex gap-2 font-mono text-[#8B7355] text-[10px]">
                <span className="rounded border border-[#E8D5B5] bg-white px-1.5 py-0.5">
                  P: {Math.round(currentTotals.protein)}g
                </span>
                <span className="rounded border border-[#E8D5B5] bg-white px-1.5 py-0.5">
                  C: {Math.round(currentTotals.carbs)}g
                </span>
                <span className="rounded border border-[#E8D5B5] bg-white px-1.5 py-0.5">
                  F: {Math.round(currentTotals.fat)}g
                </span>
              </div>
              <span className="font-bold font-mono text-[#2C2416] tabular-nums">
                {Math.round(currentTotals.calories)} kcal
              </span>
            </div>
          </div>
        </div>

        {/* Confirmed banner */}
        {confirmed && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50/80 px-4 py-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-3 w-3 text-emerald-600" />
            </div>
            <span
              className="font-medium text-emerald-700 text-xs"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Meal logged successfully
            </span>
          </div>
        )}
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
