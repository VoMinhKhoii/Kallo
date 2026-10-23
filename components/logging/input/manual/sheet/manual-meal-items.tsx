'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ManualFoodRow,
  useStateWord,
} from '@/components/logging/input/manual/manual-food-row';
import {
  formatGrams,
  type ManualSheetItem,
  mealSubtitle,
} from '@/lib/domain/logging/manual-display';
import {
  formatKcal,
  MANUAL_MEAL_MAX_ITEMS,
  macrosAt,
} from '@/lib/domain/logging/manual-logging';

/**
 * The plate: "4 ingredients", one card of what is in the meal (each row opens
 * its food page to change the amount or remove it), and "Add ingredient"
 * under it — off, and saying why, once the meal is full. Mirrors the Flutter
 * `ManualMealItems`. `onOpen` and `onAdd` are absent while the meal saves.
 */
export function ManualMealItems({
  items,
  full,
  onOpen,
  onAdd,
}: {
  items: ManualSheetItem[];
  full: boolean;
  onOpen?: (item: ManualSheetItem) => void;
  onAdd?: () => void;
}) {
  const t = useTranslations('logging.manualLogging');
  const stateWord = useStateWord();
  return (
    <>
      {items.length > 0 && (
        <>
          <p className="mx-1 mt-4 mb-2 text-[14px] text-kallo-text-muted">
            {t('ingredientCount', { count: items.length })}
          </p>
          <div className="rounded-[22px] bg-card px-4">
            {items.map((item, index) => {
              const grams = `${formatGrams(item.grams)} g`;
              return (
                <div
                  key={item.id}
                  className={index > 0 ? 'border-kallo-border border-t' : ''}
                >
                  <ManualFoodRow
                    name={item.ingredient.namePrimary}
                    nameLines={1}
                    subtitle={mealSubtitle(item.ingredient, stateWord, grams)}
                    kcal={formatKcal(
                      macrosAt(item.ingredient, item.grams).caloriesKcal
                    )}
                    quietKcal
                    label={`${item.ingredient.namePrimary}, ${grams}`}
                    onClick={onOpen && (() => onOpen(item))}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
      <button
        type="button"
        disabled={!onAdd || full}
        onClick={onAdd}
        className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[22px] bg-card px-4 py-2 text-left text-[16px] text-kallo-text transition-colors hover:bg-kallo-hover/40 disabled:opacity-60"
      >
        <Plus aria-hidden className="size-6 shrink-0" strokeWidth={1.5} />
        <span className="flex flex-col">
          {t('addIngredient')}
          {full && (
            <span className="text-[14px] text-kallo-text-muted">
              {t('mealFull', { count: MANUAL_MEAL_MAX_ITEMS })}
            </span>
          )}
        </span>
      </button>
    </>
  );
}
