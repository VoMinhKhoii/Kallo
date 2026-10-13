'use client';

import { useTranslations } from 'next-intl';
import { RemoveMealButton } from './remove-meal-button';

interface DiscardStagedButtonProps {
  onConfirm: () => void;
  disabled?: boolean;
}

/**
 * The way out of an unsaved card: a quiet trash under its save button, behind
 * the same confirm dialog a saved meal's remove uses. Without it the only exits
 * were saving the meal or waiting out its 30-minute expiry.
 */
export function DiscardStagedButton({
  onConfirm,
  disabled,
}: DiscardStagedButtonProps) {
  const t = useTranslations('logging');
  const tFeed = useTranslations('logging.feedArea');

  return (
    // Left-aligned, like the action row under a saved meal. (iOS keeps it on
    // the right, under the thumb.)
    <div className="mt-1 flex justify-start">
      <RemoveMealButton
        label={t('discard')}
        onConfirm={onConfirm}
        disabled={disabled}
        copy={{
          title: tFeed('discardConfirmTitle'),
          description: tFeed('discardConfirmDescription'),
          action: t('discard'),
        }}
      />
    </div>
  );
}
