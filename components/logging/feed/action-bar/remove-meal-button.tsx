'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionIconButton } from './action-icon-button';
import { ConfirmDialog } from './confirm-dialog';

interface RemoveMealButtonProps {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Dialog copy override — a staged card is discarded, not removed. */
  copy?: { title: string; description: string; action: string };
}

export function RemoveMealButton({
  label,
  onConfirm,
  disabled,
  copy,
}: RemoveMealButtonProps) {
  const t = useTranslations('logging.persistedMealCard');
  const tCommon = useTranslations('common');

  return (
    <ConfirmDialog
      trigger={
        <ActionIconButton
          icon={Trash2}
          label={label}
          danger
          disabled={disabled}
        />
      }
      title={copy?.title ?? t('removeConfirmTitle')}
      description={copy?.description ?? t('removeConfirmDescription')}
      confirmLabel={copy?.action ?? t('remove')}
      cancelLabel={tCommon('cancel')}
      destructive
      onConfirm={onConfirm}
    />
  );
}
