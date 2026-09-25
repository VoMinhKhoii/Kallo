'use client';

import {
  PencilLine,
  RotateCcw,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PremiumDot } from '@/components/billing/premium-dot';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { ShareMealDialog } from '@/components/groups/share-meal-dialog';
import { ShareToCircleButton } from '@/components/logging/feed/persisted/share-buttons';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { ActionIconButton } from './action-icon-button';
import { RemoveMealButton } from './remove-meal-button';

interface MealCardActionBarProps {
  mealId: string;
  /** The dish being shared — the dialog names its subject. */
  mealName: string;
  /** Whole-dish calories, for the per-person readout on the meter. */
  totalKcal: number | null;
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
  mealName,
  totalKcal,
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
  const { locked, requirePremium } = usePremiumGuard();
  const relogLocked = locked('relog');
  // Sharing a meal with friends is an INITIATED copy/split, so it is the
  // billable side of the feature — mark it before the click.
  const shareLocked = locked('copy_split');

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        {onLogAgain && (
          // The row is icon-only, so a locked action wears the Premium dot on
          // its icon rather than a chip beside it.
          <ActionIconButton
            icon={RotateCcw}
            label={t('logAgain')}
            onClick={onLogAgain}
            marker={relogLocked && <PremiumDot />}
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
        {canShare &&
          (shareLocked ? (
            // Locked: no ShareMealDialog at all, so the trigger cannot open a
            // picker whose only outcome would be a 402 from the server.
            <ActionIconButton
              icon={UserPlus}
              label={t('shareWithFriends')}
              onClick={() => requirePremium('copy_split')}
              marker={<PremiumDot />}
            />
          ) : (
            <ShareMealDialog
              mealId={mealId}
              mealName={mealName}
              totalKcal={totalKcal}
              trigger={
                <ActionIconButton
                  icon={UserPlus}
                  label={t('shareWithFriends')}
                />
              }
            />
          ))}
        {onDelete && (
          <RemoveMealButton label={t('remove')} onConfirm={onDelete} />
        )}
      </div>
      <ShareToCircleButton mealId={mealId} share={share} />
    </div>
  );
}
