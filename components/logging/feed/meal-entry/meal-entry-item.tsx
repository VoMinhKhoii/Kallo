'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import type { MealItem } from '@/lib/core/types/meal';

interface MealEntryItemProps {
  item: MealItem;
  index: number;
  /**
   * Opens the meal edit dialog on this dish — the row is a button while the
   * meal is unsaved. Omitted on a saved card, where the row is plain text.
   */
  onOpen?: () => void;
}

export function MealEntryItem({ item, index, onOpen }: MealEntryItemProps) {
  const t = useTranslations('logging.mealEdit');

  const row = (
    <>
      {/* Left: item name — flex-1 + block truncate so long names ellipsize
          instead of running under the macros */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-kallo-text">{item.name}</p>
      </div>

      {/* Right: P/C/F macros + calories */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex gap-2 text-[10px] text-kallo-text-muted tabular-nums">
          <span className="whitespace-nowrap text-right">
            P:{formatMacroValue(item.macros.protein)}
          </span>
          <span className="whitespace-nowrap text-right">
            C:{formatMacroValue(item.macros.carbs)}
          </span>
          <span className="whitespace-nowrap text-right">
            F:{formatMacroValue(item.macros.fat)}
          </span>
        </div>
        <span className="whitespace-nowrap text-right font-bold text-kallo-text tabular-nums">
          {formatCaloriesValue(item.macros.calories)}
        </span>
      </div>
    </>
  );

  const className =
    'flex w-full items-center justify-between py-2.5 text-left font-sans-display text-[13px]';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {onOpen ? (
        // The wash bleeds past the row so the name and macros keep their
        // column — the row moves nothing when it lights up.
        <button
          type="button"
          onClick={onOpen}
          aria-label={t('editDish', { name: item.name })}
          className={`${className} -mx-2.5 w-[calc(100%+1.25rem)] rounded-lg px-2.5 transition-colors hover:bg-kallo-hover/40`}
        >
          {row}
        </button>
      ) : (
        <div className={className}>{row}</div>
      )}
    </motion.div>
  );
}
