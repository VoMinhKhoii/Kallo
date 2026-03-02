'use client';

import { Check, Pencil, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { applyQuantityChange, recalculateTotals } from '@/lib/meal-utils';
import type { ChatMessage, MealItem, ParsedMeal } from '@/lib/types/meal';
import { MealCardActions } from './meal-card-actions';
import { MealCardItem } from './meal-card-item';

interface MealCardProps {
  message: ChatMessage;
  onConfirm?: (meal: ParsedMeal) => void;
}

export function MealCard({ message, onConfirm }: MealCardProps) {
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

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%]">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl rounded-bl-sm border border-[#d4c4a8] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.08)]">
          {/* Header */}
          <div className="flex items-center justify-between border-[#E8D5B5]/50 border-b bg-[#f5efe5] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2C2416] shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-[#C9A87C]" />
              </div>
              <span
                className="font-semibold text-[#2C2416] text-[11px] uppercase tracking-wider"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {meal.mealName}
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
                      style={{
                        fontFamily: 'DM Sans, sans-serif',
                      }}
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
                      style={{
                        fontFamily: 'DM Sans, sans-serif',
                      }}
                    >
                      Edit
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_4rem_3rem_3rem_3rem] items-center gap-1 border-[#E8D5B5]/30 border-b bg-[#FEFBF6]/80 px-4 py-1.5 text-[9px]">
            {['Item', 'Cal', 'Pro', 'Carb', 'Fat'].map((label, i) => (
              <span
                key={label}
                className={`${i > 0 ? 'text-right' : ''}font-semibold uppercase tracking-wider ${
                  i === 0
                    ? 'text-[#8B7355]'
                    : i === 1
                      ? 'text-[#8B7355]'
                      : i === 2
                        ? 'text-blue-500'
                        : i === 3
                          ? 'text-amber-500'
                          : 'text-rose-400'
                }`}
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Items list */}
          <div className="divide-y divide-[#F0EAE0]/40 px-4">
            {currentItems.map((item, idx) => (
              <MealCardItem
                key={item.id}
                item={item}
                index={idx}
                isEditing={isEditing}
                onQuantityChange={handleQuantityChange}
              />
            ))}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-[1fr_4rem_3rem_3rem_3rem] items-center gap-1 border-[#E8D5B5]/50 border-t bg-[#FEFBF6]/90 px-4 py-3 text-xs">
            <span
              className="font-semibold text-[#2C2416] text-sm"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Total
            </span>
            <span
              className="text-right font-bold text-[#2C2416] tabular-nums"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {Math.round(currentTotals.calories)}
            </span>
            <span
              className="text-right font-semibold text-blue-600 tabular-nums"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {Math.round(currentTotals.protein)}g
            </span>
            <span
              className="text-right font-semibold text-amber-600 tabular-nums"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {Math.round(currentTotals.carbs)}g
            </span>
            <span
              className="text-right font-semibold text-rose-500 tabular-nums"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {Math.round(currentTotals.fat)}g
            </span>
          </div>

          {/* Confirmed banner */}
          {confirmed && (
            <div className="flex items-center justify-center gap-2 border-[#E8D5B5]/50 border-t bg-[#f0ebe3] px-4 py-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              <span
                className="font-medium text-emerald-700 text-xs"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Meal logged successfully
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!confirmed && (
          <MealCardActions
            isEditing={isEditing}
            onCancel={handleCancelEdit}
            onSave={handleSaveEdit}
            onConfirm={handleConfirm}
          />
        )}

        <p
          className="mt-1.5 ml-1 text-left text-[#8B7355]/50 text-[10px]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
