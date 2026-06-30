'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface MealEntryActionsProps {
  isEditing: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}

export function MealEntryActions({
  isEditing,
  disabled,
  onConfirm,
}: MealEntryActionsProps) {
  const t = useTranslations('logging');

  return (
    <div className="mt-3 flex">
      {/* While editing the button demotes to a ghost style so it pulls less
          focus than the +/- controls, but stays clickable. */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className={cn(
          'relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-3 py-2.5 font-medium text-xs transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
          isEditing
            ? 'border border-nham-btn/40 bg-transparent text-nham-btn enabled:hover:border-nham-btn enabled:hover:bg-nham-btn/5'
            : 'bg-nham-btn text-white shadow-sm enabled:hover:bg-nham-btn-hover enabled:hover:shadow-md',
          'font-sans-display'
        )}
      >
        <Check className="h-3.5 w-3.5 shrink-0" />
        {t('confirm')}
      </button>
    </div>
  );
}
