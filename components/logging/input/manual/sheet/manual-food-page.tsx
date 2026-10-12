'use client';

import { useTranslations } from 'next-intl';
import { ScanResultHeader } from '@/components/logging/input/scan/result/header';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { englishName } from '@/lib/domain/logging/manual-display';
import {
  type IngredientSearchResult,
  MANUAL_MEAL_MAX_ITEMS,
  macrosAt,
} from '@/lib/domain/logging/manual-logging';
import { ManualAmountCard } from './manual-amount-card';

const PRIMARY =
  'flex h-[52px] w-full items-center justify-center rounded-full bg-kallo-hover font-semibold text-[16px] text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-55 disabled:hover:bg-kallo-hover';

/**
 * One food, weighed before it goes in (approved canvas, E4): the scan
 * result's header — name, hero calories for the amount, the English name and
 * the calorie-share bar — over the amount card, with "Add to meal" (or
 * "Update" for a food already in it) docked under them. Mirrors the Flutter
 * `ManualFoodPage`.
 */
export function ManualFoodPage({
  food,
  grams,
  inMeal,
  blocked = false,
  onGrams,
  onCommit,
  onBack,
  onClose,
  onRemove,
}: {
  food: IngredientSearchResult;
  grams: number;
  inMeal: boolean;
  /** A new food a full meal cannot take: the commit is off, and says why. */
  blocked?: boolean;
  onGrams: (grams: number) => void;
  onCommit: () => void;
  /** Back to the results; absent when opened from the meal itself. */
  onBack?: () => void;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const t = useTranslations('logging.manualLogging');
  const macros = useTranslations('logging');
  const at = macrosAt(food, grams);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResponsiveSheetHeader
        title={t('sheetTitle')}
        closeLabel={t('close')}
        backLabel={t('back')}
        onClose={onClose}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <ScanResultHeader
          name={food.namePrimary}
          subtitle={englishName(food)}
          kcal={at.caloriesKcal}
          grams={{
            protein: at.proteinG,
            carbohydrate: at.carbohydrateG,
            fat: at.fatG,
          }}
          labels={{
            protein: macros('barcodeProtein'),
            carbohydrate: macros('barcodeCarbs'),
            fat: macros('barcodeFat'),
          }}
        />
        <div className="mt-5">
          <ManualAmountCard food={food} grams={grams} onGrams={onGrams} />
        </div>
      </div>
      <div className="shrink-0 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {blocked && (
          <p className="mb-2 text-center text-[14px] text-kallo-text-muted">
            {t('mealFull', { count: MANUAL_MEAL_MAX_ITEMS })}
          </p>
        )}
        <button
          type="button"
          disabled={blocked}
          onClick={onCommit}
          className={PRIMARY}
        >
          {inMeal ? t('update') : t('addToMeal')}
        </button>
        {inMeal && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-1 flex h-11 w-full items-center justify-center rounded-full font-semibold text-[16px] text-kallo-danger transition-colors hover:bg-kallo-danger/10"
          >
            {t('remove')}
          </button>
        )}
      </div>
    </div>
  );
}
