'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/core/ui/cn';

interface MealEntryActionsProps {
  disabled?: boolean;
  onConfirm: () => void;
}

export function MealEntryActions({
  disabled,
  onConfirm,
}: MealEntryActionsProps) {
  const t = useTranslations('logging');

  return (
    <div className="mt-3 flex">
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className={cn(
          'relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-3 py-2.5 font-medium text-xs transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
          'bg-kallo-btn text-kallo-btn-ink shadow-sm enabled:hover:bg-kallo-btn-hover enabled:hover:shadow-md',
          'font-sans-display'
        )}
      >
        <Check className="h-3.5 w-3.5 shrink-0" />
        {t('confirm')}
      </button>
    </div>
  );
}
