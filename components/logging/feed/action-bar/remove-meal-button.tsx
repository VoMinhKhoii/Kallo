'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ActionIconButton } from './action-icon-button';

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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <ActionIconButton
          icon={Trash2}
          label={label}
          danger
          disabled={disabled}
        />
      </AlertDialogTrigger>
      <AlertDialogContent className="border-[#E8E6DC] bg-white text-[#141413]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-sans-display text-[18px]">
            {copy?.title ?? t('removeConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans-display text-[#6E6D66] text-[13px]">
            {copy?.description ?? t('removeConfirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="ghost"
            className="text-kallo-danger hover:bg-transparent hover:text-kallo-danger"
            onClick={onConfirm}
          >
            {copy?.action ?? t('remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
