'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { MealCardActionBar } from '@/components/logging/feed/action-bar/meal-card-action-bar';
import { CardDisclosureButton } from '@/components/logging/feed/card-disclosure-button';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import { MealCardContextMenu } from '@/components/logging/feed/meal-edit/meal-card-context-menu';
import type { MealCardMenuItem } from '@/components/logging/feed/meal-edit/meal-card-menu-button';
import { MealEditDialog } from '@/components/logging/feed/meal-edit/meal-edit-dialog';
import { TurnHeader } from '@/components/logging/feed/turn/turn-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';
import { formatTime } from '@/lib/core/date/format-time';
import {
  draftFromPersisted,
  persistedEditFrom,
} from '@/lib/domain/meals/meal-edit/meal-edit-sources';
import { PersistedMealBody } from './persisted-meal-body';
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
  const tEdit = useTranslations('logging.mealEdit');
  const tLogging = useTranslations('logging');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  // "Fix with words" from the always-visible action row — opens the refine
  // input directly.
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  // Only meals with gram-bearing ingredient rows can be edited; a legacy/empty
  // meal (no item rows) has nothing to scale.
  const canEdit =
    onUpdate != null &&
    meal.mealItemGroups.some((g) =>
      g.ingredients.some((i) => (i.estimatedGrams ?? 0) > 0)
    );
  // Copy/split need item rows to reproduce; a legacy/empty meal has none.
  const canShare = meal.mealItemGroups.some((g) => g.ingredients.length > 0);
  // A split share (or accepted split copy) is a fraction of a full portion.
  const portionFactor = meal.portionFactor ?? 1;
  const isFractional = portionFactor > 0 && portionFactor < 1;
  const portionText = isFractional ? `1/${Math.round(1 / portionFactor)}` : '';
  // NL-refine re-estimates the FULL portion from the text, silently undoing a
  // split — so hide "Fix with words" on a fractional meal (the edit dialog
  // still works for tweaking the share).
  const refine = isFractional ? undefined : onRefine;

  const totals = {
    calories: formatCaloriesOrNA(meal.nutrition.caloriesKcal),
    protein: formatMacroOrNA(meal.nutrition.proteinG),
    carbs: formatMacroOrNA(meal.nutrition.carbohydrateG),
    fat: formatMacroOrNA(meal.nutrition.fatG),
  };

  // Edit and Remove live in the card's menus — its ⋯ and a right-click (or a
  // press and hold on touch) — not as icons in the row under it.
  const menuItems: MealCardMenuItem[] = [
    ...(canEdit
      ? [
          {
            label: tLogging('edit'),
            icon: Pencil,
            onSelect: () => setIsEditing(true),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: t('remove'),
            icon: Trash2,
            danger: true,
            onSelect: () => setIsRemoving(true),
          },
        ]
      : []),
  ];

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative"
    >
      <TurnHeader
        timeLabel={formatTime(meal.loggedAt, locale)}
        message={meal.rawInput}
      >
        {isFractional && (
          <span className="rounded-full bg-kallo-hover px-2 py-0.5 font-medium font-sans-display text-[10px] text-kallo-text">
            {t('portionChip', { portion: portionText })}
          </span>
        )}
      </TurnHeader>

      <MealCardContextMenu items={menuItems}>
        <div className="rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-sans-display text-kallo-text text-sm leading-relaxed">
              {meal.rawInput}
            </p>
            <CardDisclosureButton
              label={t('toggleDetails')}
              isExpanded={!isCollapsed}
              onToggle={() => setIsCollapsed((prev) => !prev)}
            />
          </div>
          <PersistedMealBody
            meal={meal}
            isCollapsed={isCollapsed}
            totals={totals}
          />
          {/* The refine field opened from the action row — one interaction
              from the collapsed card. */}
          {isRefineOpen && refine && (
            <div className="mt-3 border-kallo-border/40 border-t pt-3">
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
      </MealCardContextMenu>

      <div className="mt-1.5 px-1">
        <MealCardActionBar
          mealId={meal.id}
          mealName={meal.rawInput}
          totalKcal={meal.nutrition.caloriesKcal ?? null}
          share={meal.share}
          canShare={canShare}
          isRefineOpen={isRefineOpen}
          onLogAgain={onLogAgain}
          onRefineToggle={
            refine ? () => setIsRefineOpen((prev) => !prev) : undefined
          }
          menuItems={menuItems}
        />
      </div>

      {canEdit && onUpdate && (
        <MealEditDialog
          open={isEditing}
          onOpenChange={setIsEditing}
          initial={draftFromPersisted(meal)}
          subtitle={meal.rawInput}
          commitLabel={tEdit('save')}
          onCommit={async (draft) => {
            const changes = persistedEditFrom(meal, draft);
            // An untouched dialog saves nothing.
            if (changes.edits.length === 0 && changes.removeIds.length === 0)
              return;
            await onUpdate(changes);
          }}
        />
      )}
      {onDelete && (
        <ConfirmDialog
          open={isRemoving}
          onOpenChange={setIsRemoving}
          title={t('removeConfirmTitle')}
          description={t('removeConfirmDescription')}
          confirmLabel={t('remove')}
          cancelLabel={tCommon('cancel')}
          tone="destructive"
          onConfirm={onDelete}
        />
      )}
    </motion.article>
  );
}
