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
}

export function RemoveMealButton({ label, onConfirm }: RemoveMealButtonProps) {
  const t = useTranslations('logging.persistedMealCard');
  const tCommon = useTranslations('common');

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <ActionIconButton icon={Trash2} label={label} danger />
      </AlertDialogTrigger>
      <AlertDialogContent className="border-[#E8E6DC] bg-white text-[#141413]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-sans-display text-[18px]">
            {t('removeConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans-display text-[#6E6D66] text-[13px]">
            {t('removeConfirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="ghost"
            className="text-kallo-danger hover:bg-transparent hover:text-kallo-danger"
            onClick={onConfirm}
          >
            {t('remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
