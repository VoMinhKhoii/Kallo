'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CardDisclosureButton } from '@/components/logging/feed/card-disclosure-button';
import { MealCardContextMenu } from '@/components/logging/feed/meal-edit/meal-card-context-menu';
import {
  MealCardMenuButton,
  type MealCardMenuItem,
} from '@/components/logging/feed/meal-edit/meal-card-menu-button';
import { MealEditDialog } from '@/components/logging/feed/meal-edit/meal-edit-dialog';
import { MealEntryActions } from '@/components/logging/feed/meal-entry/meal-entry-actions';
import { MealEntryDetails } from '@/components/logging/feed/meal-entry/meal-entry-details';
import { repointVesselTo } from '@/components/logging/feed/meal-entry/portion/portion-picker';
import { TurnHeader } from '@/components/logging/feed/turn/turn-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';
import { formatTime } from '@/lib/core/date/format-time';
import type {
  ChatMessage,
  MealItem,
  MealQuantityEdit,
} from '@/lib/core/types/meal';
import {
  draftFromStaged,
  stagedItemsFrom,
} from '@/lib/domain/meals/meal-edit/meal-edit-sources';
import {
  deriveQuantityEdits,
  recalculateTotals,
} from '@/lib/domain/meals/quantity-recalculation';

interface MealEntryProps {
  message: ChatMessage;
  onConfirm?: (edits: MealQuantityEdit[]) => void;
  // Disables the confirm action while a save is in flight, so a fast
  // double-click can't dispatch two saves (two mealIds → two inserts).
  isConfirming?: boolean;
  /** The answer to a run just watched: it takes over in place, not enters. */
  revealing?: boolean;
  /** Throws the staged analysis away, after a confirm. Omitted: no Discard. */
  onDiscard?: () => void;
}

export function MealEntry({
  message,
  onConfirm,
  isConfirming,
  revealing = false,
  onDiscard,
}: MealEntryProps) {
  const t = useTranslations('logging.mealEntry');
  const tLogging = useTranslations('logging');
  const tEdit = useTranslations('logging.mealEdit');
  const tFeed = useTranslations('logging.feedArea');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [confirmed, setConfirmed] = useState(false);
  const [items, setItems] = useState<MealItem[]>(
    message.parsedMeal?.items ?? []
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const meal = message.parsedMeal;
  if (!meal) return null;

  const currentTotals = recalculateTotals(items);

  const handleConfirm = () => {
    const edits = deriveQuantityEdits(items, meal.items);
    setConfirmed(true);
    setIsCollapsed(true);
    onConfirm?.(edits);
  };

  // Unsaved: the card's own menus carry Edit and Discard, and every dish row is
  // a way into the edit dialog. Nothing sits under the save button.
  const menuItems: MealCardMenuItem[] = confirmed
    ? []
    : [
        {
          label: tLogging('edit'),
          icon: Pencil,
          onSelect: () => setIsEditing(true),
        },
        ...(onDiscard && !isConfirming
          ? [
              {
                label: tLogging('discard'),
                icon: Trash2,
                danger: true,
                onSelect: () => setIsDiscarding(true),
              },
            ]
          : []),
      ];
  const openEditor = confirmed ? undefined : () => setIsEditing(true);

  const totalsLine = (
    <span className="text-[11px] text-kallo-text-muted tabular-nums">
      P: {Math.round(currentTotals.protein)}g{'  '}C:{' '}
      {Math.round(currentTotals.carbs)}g{'  '}F: {Math.round(currentTotals.fat)}
      g
    </span>
  );

  return (
    <motion.article
      // A CONTINUATION, not an arrival: the message and dishes were on screen
      // a frame ago, so fading the block in blinks what was being read.
      initial={revealing ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative"
    >
      <TurnHeader
        timeLabel={formatTime(message.timestamp, locale)}
        message={message.userInput}
      />

      <MealCardContextMenu items={menuItems}>
        <div className="rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
          {/* Header: quoted input + its one control */}
          <div className="flex items-start justify-between gap-3">
            {message.userInput && (
              <p className="font-sans-display text-kallo-text text-sm leading-relaxed">
                {message.userInput}
              </p>
            )}
            {confirmed ? (
              <CardDisclosureButton
                label={t('toggleDetails')}
                isExpanded={!isCollapsed}
                onToggle={() => setIsCollapsed((prev) => !prev)}
              />
            ) : (
              <div className="-mt-1 -mr-1.5 shrink-0">
                <MealCardMenuButton items={menuItems} />
              </div>
            )}
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
                {totalsLine}
                <span className="font-bold text-kallo-text text-sm tabular-nums">
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
                <MealEntryDetails
                  items={items}
                  totals={currentTotals}
                  totalsLine={totalsLine}
                  onOpen={openEditor}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MealCardContextMenu>

      {!confirmed && (
        <MealEntryActions disabled={isConfirming} onConfirm={handleConfirm} />
      )}

      {!confirmed && (
        <MealEditDialog
          open={isEditing}
          onOpenChange={setIsEditing}
          initial={draftFromStaged(items, meal.items)}
          subtitle={message.userInput}
          commitLabel={tEdit('done')}
          onCommit={(draft) =>
            setItems((current) =>
              stagedItemsFrom(draft, current, (vessel, grams) =>
                repointVesselTo(vessel, grams, locale)
              )
            )
          }
        />
      )}
      {onDiscard && (
        <ConfirmDialog
          open={isDiscarding}
          onOpenChange={setIsDiscarding}
          title={tFeed('discardConfirmTitle')}
          description={tFeed('discardConfirmDescription')}
          confirmLabel={tLogging('discard')}
          cancelLabel={tCommon('cancel')}
          tone="destructive"
          onConfirm={onDiscard}
        />
      )}
    </motion.article>
  );
}
