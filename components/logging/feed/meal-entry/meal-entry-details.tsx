'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MealEntryItem } from '@/components/logging/feed/meal-entry/meal-entry-item';
import { PortionAssumptionLine } from '@/components/logging/feed/meal-entry/portion/portion-assumption-line';
import type { MacroBreakdown, MealItem } from '@/lib/core/types/meal';

interface MealEntryDetailsProps {
  items: MealItem[];
  totals: MacroBreakdown;
  /** The P/C/F run the collapsed summary shows too. */
  totalsLine: ReactNode;
  /** Opens the edit dialog; undefined once the meal is saved. */
  onOpen?: () => void;
  /** Opens the edit dialog onto this dish's Size; undefined once saved. */
  onOpenSize?: (itemId: string) => void;
}

/**
 * The opened body of an unsaved card: each dish (a button into the edit
 * dialog while unsaved), its portion line, and the Total row.
 */
export function MealEntryDetails({
  items,
  totals,
  totalsLine,
  onOpen,
  onOpenSize,
}: MealEntryDetailsProps) {
  const t = useTranslations('logging.mealEntry');
  return (
    <div className="mt-5 border-kallo-border border-t pt-4">
      <div className="mb-4 space-y-1">
        {items.map((item, idx) => (
          <div key={item.id}>
            <MealEntryItem item={item} index={idx} onOpen={onOpen} />
            {onOpenSize && item.vessel && (
              <PortionAssumptionLine
                vessel={item.vessel}
                grams={item.quantity}
                onClick={() => onOpenSize(item.id)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Totals — flat, no card */}
      <div className="flex items-center justify-between border-kallo-border/50 border-t pt-3">
        <span className="font-bold font-sans-display text-[13px] text-kallo-text">
          {t('total')}
        </span>
        <div className="flex items-center gap-4 font-sans-display">
          {totalsLine}
          <span className="font-bold text-kallo-text tabular-nums">
            {Math.round(totals.calories)} kcal
          </span>
        </div>
      </div>
    </div>
  );
}
