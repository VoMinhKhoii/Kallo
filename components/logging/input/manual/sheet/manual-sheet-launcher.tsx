'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { sheetItemsAsRows } from '@/lib/domain/logging/manual-display';
import {
  type CompleteManualMealRow,
  formatKcal,
  totalsForRows,
} from '@/lib/domain/logging/manual-logging';
import { ManualMealSheet } from './manual-meal-sheet';
import { useManualSheet } from './use-manual-sheet';

/**
 * Manual mode on a phone: the composer's field becomes one tap into the
 * manual-log sheet — the same two stacked sheets the iOS app opens — and
 * says what is already on the plate when there is something. The plate lives
 * here, so closing the sheet by accident keeps it.
 */
export function ManualSheetLauncher({
  open,
  onOpenChange,
  disabled,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onSave: (rows: CompleteManualMealRow[], name: string) => Promise<void>;
}) {
  const t = useTranslations('logging.manualLogging');
  const meal = useManualSheet();
  const total = totalsForRows(sheetItemsAsRows(meal.items)).caloriesKcal;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(true)}
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl px-1 text-left text-[16px] text-kallo-text-muted transition-colors hover:text-kallo-text disabled:opacity-50"
      >
        <Plus aria-hidden className="size-5 shrink-0" strokeWidth={1.5} />
        <span className="truncate">
          {meal.items.length > 0
            ? t('peek', {
                count: t('ingredientCount', { count: meal.items.length }),
                kcal: formatKcal(total),
              })
            : t('sheetTitle')}
        </span>
      </button>
      <ManualMealSheet
        open={open}
        onOpenChange={onOpenChange}
        meal={meal}
        onSave={(name) => onSave(sheetItemsAsRows(meal.items), name)}
      />
    </>
  );
}
