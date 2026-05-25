'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MealEntryActionsProps {
  onConfirm: () => void;
}

export function MealEntryActions({ onConfirm }: MealEntryActionsProps) {
  const t = useTranslations('logging');

  return (
    <div className="mt-3 flex">
      <button
        type="button"
        onClick={onConfirm}
        className="relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-nham-btn px-3 py-2.5 font-medium text-white text-xs shadow-sm transition-all duration-200 hover:bg-nham-btn-hover hover:shadow-md"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        <Check className="h-3.5 w-3.5 shrink-0" />
        {t('confirm')}
      </button>
    </div>
  );
}
