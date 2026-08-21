'use client';

import {
  PencilLine,
  RotateCcw,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { ShareMealDialog } from '@/components/groups/share-meal-dialog';
import { ShareToCircleButton } from '@/components/logging/feed/persisted/share-buttons';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { COPY_SPLIT_LIVE } from '@/lib/domain/social/copy-split-live';
import { ActionIconButton } from './action-icon-button';
import { RemoveMealButton } from './remove-meal-button';

interface MealCardActionBarProps {
  mealId: string;
  share: PersistedMeal['share'];
  canEdit: boolean;
  canShare?: boolean;
  isRefineOpen: boolean;
  onLogAgain?: () => void;
  onRefineToggle?: () => void;
  onEditAmounts: () => void;
  onDelete?: () => void;
}

export function MealCardActionBar({
  mealId,
  share,
  canEdit,
  canShare,
  isRefineOpen,
  onLogAgain,
  onRefineToggle,
  onEditAmounts,
  onDelete,
}: MealCardActionBarProps) {
  const t = useTranslations('logging.persistedMealCard');
  const { locked } = usePremiumGuard();
  const relogLocked = locked('relog');

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        {onLogAgain && (
          <>
            <ActionIconButton
              icon={RotateCcw}
              label={t('logAgain')}
              onClick={onLogAgain}
            />
            {/* The row is icon-only, so the chip rides beside the button it
                marks rather than inside it — compact padding keeps the bar on
                one line on a narrow card. */}
            {relogLocked && <PremiumChip className="mr-1 px-1.5 py-0" />}
          </>
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
        {/* Copy/split is paused — the only entry point to it on this card is
            hidden outright (no premium chip: it is not a purchase away). */}
        {COPY_SPLIT_LIVE && canShare && (
          <ShareMealDialog
            mealId={mealId}
            trigger={
              <ActionIconButton icon={UserPlus} label={t('shareWithFriends')} />
            }
          />
        )}
        {onDelete && (
          <RemoveMealButton label={t('remove')} onConfirm={onDelete} />
        )}
      </div>
      <ShareToCircleButton mealId={mealId} share={share} />
    </div>
  );
}
