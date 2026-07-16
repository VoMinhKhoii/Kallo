'use client';

import { useTranslations } from 'next-intl';
import { ShareMealDialog } from '@/components/groups/share-meal-dialog';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { ShareToCircleButton } from './share-buttons';

/** Post-save actions — the correction row, never at the text input. */
export function CardActionRow({
  meal,
  canEdit,
  canShare,
  isRefineOpen,
  onLogAgain,
  onRefineToggle,
  onEditAmounts,
  onDelete,
}: {
  meal: PersistedMeal;
  canEdit: boolean;
  /** Copy/split need item rows to reproduce; a legacy/empty meal has none. */
  canShare?: boolean;
  isRefineOpen: boolean;
  onLogAgain?: () => void;
  onRefineToggle?: () => void;
  onEditAmounts: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations('logging.persistedMealCard');
  return (
    <div className="mt-3 flex items-center justify-between border-nham-border/40 border-t border-dashed pt-2.5">
      <div className="flex items-center gap-0.5">
        {onLogAgain && (
          <button
            type="button"
            onClick={onLogAgain}
            className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
          >
            {t('logAgain')}
          </button>
        )}
        {onRefineToggle && (
          <button
            type="button"
            aria-expanded={isRefineOpen}
            onClick={onRefineToggle}
            className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
          >
            {t('refineAction')}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEditAmounts}
            className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
          >
            {t('editAmounts')}
          </button>
        )}
        {canShare && (
          <ShareMealDialog
            mealId={meal.id}
            trigger={
              <button
                type="button"
                className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
              >
                {t('shareWithFriends')}
              </button>
            }
          />
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-danger/10 hover:text-nham-danger"
          >
            {t('remove')}
          </button>
        )}
      </div>
      <ShareToCircleButton mealId={meal.id} share={meal.share} />
    </div>
  );
}
