'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { MealCardActionBar } from '@/components/logging/feed/action-bar/meal-card-action-bar';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import { TimeDivider } from '@/components/logging/feed/time-divider';
import { MealAmountEditor } from './meal-amount-editor';
import { MealDetails } from './meal-details';
// The NL-refine is submitted as `${rawInput} (${correction})` — the joining
import type { PersistedMealCardProps } from './persisted-meal-card';
import { RefineField } from './refine-field';

export function PrecisePersistedMealCard({
  meal,
  onDelete,
  onLogAgain,
  onUpdate,
  onRefine,
}: PersistedMealCardProps) {
  const t = useTranslations('logging.persistedMealCard');
  const locale = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  // "Fix with words" from the always-visible action row — opens the refine
  // input directly, without requiring expand → Edit amounts.
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  // Only meals with gram-bearing ingredient rows can be amount-edited; a
  // legacy/empty meal (no item rows) has nothing to step.
  const canEdit =
    onUpdate != null &&
    meal.mealItemGroups.some((g) =>
      g.ingredients.some((i) => i.estimatedGrams != null)
    );
  // Copy/split need item rows to reproduce; a legacy/empty meal has none.
  const canShare = meal.mealItemGroups.some((g) => g.ingredients.length > 0);
  // A split share (or accepted split copy) is a fraction of a full portion.
  const portionFactor = meal.portionFactor ?? 1;
  const isFractional = portionFactor > 0 && portionFactor < 1;
  const portionText = isFractional ? `1/${Math.round(1 / portionFactor)}` : '';
  // NL-refine re-estimates the FULL portion from the text, silently undoing a
  // split — so hide "Fix with words" on a fractional meal (amount-edit still
  // works for tweaking the share).
  const refine = isFractional ? undefined : onRefine;

  const timeLabel = new Date(meal.loggedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const calories = formatCaloriesOrNA(meal.nutrition.caloriesKcal);
  const protein = formatMacroOrNA(meal.nutrition.proteinG);
  const carbs = formatMacroOrNA(meal.nutrition.carbohydrateG);
  const fat = formatMacroOrNA(meal.nutrition.fatG);

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative"
    >
      <TimeDivider timeLabel={timeLabel}>
        {isFractional && (
          <span className="rounded-full bg-nham-hover px-2 py-0.5 font-medium font-sans-display text-[10px] text-nham-text">
            {t('portionChip', { portion: portionText })}
          </span>
        )}
      </TimeDivider>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
            {meal.rawInput}
          </p>
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
        </div>

        {/* Collapsed summary — hidden while editing: the amount editor's live
            Total row already shows the (rescaling) macros. */}
        <AnimatePresence initial={false}>
          {!isEditing && isCollapsed && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 flex items-center justify-between font-sans-display"
            >
              <span className="text-[11px] text-nham-text-muted tabular-nums">
                P: {protein}
                {'  '}C: {carbs}
                {'  '}F: {fat}
              </span>
              <span className="font-bold text-nham-text text-sm tabular-nums">
                {calories}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Amount editor — replaces the read-only details while editing */}
        {isEditing && onUpdate && (
          <MealAmountEditor
            meal={meal}
            onCancel={() => setIsEditing(false)}
            onSave={onUpdate}
            onRefine={
              refine
                ? (correction) => {
                    setIsEditing(false);
                    refine(correction);
                  }
                : undefined
            }
          />
        )}

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {!isEditing && !isCollapsed && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <MealDetails
                meal={meal}
                totals={{ calories, protein, carbs, fat }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* The refine field opened from the action row — one interaction from
            the collapsed card. Also available inside the amount editor. */}
        {!isEditing && isRefineOpen && refine && (
          <div className="mt-3 border-nham-border/40 border-t pt-3">
            <RefineField
              meal={meal}
              autoFocus
              onRefine={(correction) => {
                setIsRefineOpen(false);
                refine(correction);
              }}
            />
          </div>
        )}
      </div>
      {!isEditing && (
        <div className="mt-1.5 px-1">
          <MealCardActionBar
            meal={meal}
            canEdit={canEdit}
            canShare={canShare}
            isRefineOpen={isRefineOpen}
            onLogAgain={onLogAgain}
            onRefineToggle={
              refine ? () => setIsRefineOpen((prev) => !prev) : undefined
            }
            onEditAmounts={() => {
              setIsRefineOpen(false);
              setIsEditing(true);
            }}
            onDelete={onDelete}
          />
        </div>
      )}
    </motion.article>
  );
}
