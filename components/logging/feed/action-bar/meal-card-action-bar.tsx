'use client';

import {
  PencilLine,
  RotateCcw,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShareMealDialog } from '@/components/groups/share-meal-dialog';
import { ShareToCircleButton } from '@/components/logging/feed/persisted/share-buttons';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { ActionIconButton } from './action-icon-button';
import { RemoveMealButton } from './remove-meal-button';

interface MealCardActionBarProps {
  meal: PersistedMeal;
  canEdit: boolean;
  canShare?: boolean;
  isRefineOpen: boolean;
  onLogAgain?: () => void;
  onRefineToggle?: () => void;
  onEditAmounts: () => void;
  onDelete?: () => void;
}

export function MealCardActionBar({
  meal,
  canEdit,
  canShare,
  isRefineOpen,
  onLogAgain,
  onRefineToggle,
  onEditAmounts,
  onDelete,
}: MealCardActionBarProps) {
  const t = useTranslations('logging.persistedMealCard');

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        {onLogAgain && (
          <ActionIconButton
            icon={RotateCcw}
            label={t('logAgain')}
            onClick={onLogAgain}
          />
        )}
        {onRefineToggle && (
          <ActionIconButton
            icon={PencilLine}
            label={t('refineAction')}
            aria-expanded={isRefineOpen}
            onClick={onRefineToggle}
          />
        )}
        {canEdit && (
          <ActionIconButton
            icon={SlidersHorizontal}
            label={t('editAmounts')}
            onClick={onEditAmounts}
          />
        )}
        {canShare && (
          <ShareMealDialog
            mealId={meal.id}
            trigger={
              <ActionIconButton icon={UserPlus} label={t('shareWithFriends')} />
            }
          />
        )}
        {onDelete && (
          <RemoveMealButton label={t('remove')} onConfirm={onDelete} />
        )}
      </div>
      <ShareToCircleButton mealId={meal.id} share={meal.share} />
    </div>
  );
}
