'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { ShareMealDialog } from '@/components/groups/share-meal-dialog';
import { ActionIconButton } from '@/components/logging/feed/action-bar/action-icon-button';
import { RemoveMealButton } from '@/components/logging/feed/action-bar/remove-meal-button';
import { ShareToCircleButton } from '@/components/logging/feed/persisted/share-buttons';
import type { PersistedMeal } from '@/lib/actions/meals/types';

/**
 * The cheat card's action row — the precise card's `MealCardActionBar` minus
 * everything a cheat occasion cannot do.
 *
 * No "log again" (the occasion chips own repeating a cheat), no refine and no
 * edit-amounts (both re-estimate from item rows a cheat meal does not have).
 * What is left is the two things sharing needs: the circle toggle, and an
 * offer to specific friends.
 *
 * Sharing is COPY-only here, hence `copyOnly` on the dialog: a cheat meal's
 * numbers are four slider positions, not a dish that halves. The recipient
 * reopens those sliders and sets their own amounts instead.
 */
export function CheatMealActions({
  meal,
  onDelete,
}: {
  meal: PersistedMeal;
  onDelete?: () => void;
}) {
  const t = useTranslations('logging.persistedMealCard');
  const tRemove = useTranslations('logging.cheatMealCard');
  const { locked, requirePremium } = usePremiumGuard();
  // Offering a meal to friends is an INITIATED copy — the billable side of the
  // feature — so chip it before the click rather than after a 402.
  const shareLocked = locked('copy_split');
  // Slider data is what a recipient reopens; without it the server refuses, so
  // do not offer the action at all.
  const canShare = meal.cheatSliders != null;

  return (
    <div className="mt-1.5 flex items-center justify-between px-1">
      <div className="flex items-center gap-0.5">
        {canShare &&
          (shareLocked ? (
            // Locked: no dialog at all, so the trigger cannot open a picker
            // whose only outcome would be a 402 from the server.
            <>
              <ActionIconButton
                icon={UserPlus}
                label={t('shareWithFriends')}
                onClick={() => requirePremium('copy_split')}
              />
              <PremiumChip className="mr-1 px-1.5 py-0" />
            </>
          ) : (
            <ShareMealDialog
              copyOnly
              mealId={meal.id}
              mealName={meal.rawInput}
              totalKcal={meal.nutrition.caloriesKcal}
              trigger={
                <ActionIconButton
                  icon={UserPlus}
                  label={t('shareWithFriends')}
                />
              }
            />
          ))}
        {onDelete && (
          <RemoveMealButton label={tRemove('remove')} onConfirm={onDelete} />
        )}
      </div>
      {/* Rendered unconditionally, exactly as the precise bar does. Cheat meals
          are already auto-shared to the circle on save (confirmCheatMeal calls
          insertDefaultCircleShare), so without this toggle the owner had no way
          to see that — or undo it. */}
      <ShareToCircleButton mealId={meal.id} share={meal.share} />
    </div>
  );
}
