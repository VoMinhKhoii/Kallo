'use client';

import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { MIN_DISH_GRAMS } from '@/lib/meal-utils';
import type { MealItem } from '@/lib/types/meal';

interface MealEntryItemProps {
  item: MealItem;
  index: number;
  isEditing: boolean;
  onQuantityChange: (itemId: string, delta: number) => void;
}

export function MealEntryItem({
  item,
  index,
  isEditing,
  onQuantityChange,
}: MealEntryItemProps) {
  const t = useTranslations('logging.mealEntry');
  const getDelta = (sign: 1 | -1) =>
    (item.unit === 'g' || item.unit === 'ml' ? 10 : 1) * sign;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between py-2.5 font-sans-display text-[13px]"
    >
      {/* Left: item name */}
      <div className="flex min-w-0 items-center">
        <span className="truncate font-medium text-nham-text">{item.name}</span>
      </div>

      {/* Right: edit controls + P/C/F macros + calories */}
      <div className="flex shrink-0 items-center gap-3">
        {isEditing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={t('decreaseQuantity', { name: item.name })}
              disabled={item.quantity <= MIN_DISH_GRAMS}
              onClick={() => onQuantityChange(item.id, getDelta(-1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border bg-white text-nham-text transition-colors hover:bg-nham-hover disabled:opacity-40"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="w-7 text-center font-semibold text-[11px] text-nham-text tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label={t('increaseQuantity', { name: item.name })}
              onClick={() => onQuantityChange(item.id, getDelta(1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border bg-white text-nham-text transition-colors hover:bg-nham-hover"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2 text-[10px] text-nham-text-muted tabular-nums">
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
        <span className="whitespace-nowrap text-right font-bold text-nham-text tabular-nums">
          {formatCaloriesValue(item.macros.calories)}
        </span>
      </div>
    </motion.div>
  );
}
