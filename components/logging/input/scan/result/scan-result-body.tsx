'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  canStepScanAmount,
  formatSize,
  portionsFor,
  resolveScanAmount,
  type ScanAmount,
  type ScanPortion,
  stepScanAmount,
  withCustom,
  withPortion,
} from '@/lib/domain/scan/amount';
import { type ScanFood, valueFor } from '@/lib/domain/scan/food';
import { ScanAmountCard, type ScanPortionChoice } from './scan-amount-card';
import { ScanAmountInput } from './scan-amount-input';
import { ScanCupRow } from './scan-cup-row';
import { hasOtherNutrients } from './scan-other-nutrients';
import { ScanResultHeader } from './scan-result-header';

/** The header for `food` at `amount` — shared by both result levels. */
export function ScanFoodHeader({
  food,
  amount,
  subtitle,
}: {
  food: ScanFood;
  amount: number;
  subtitle: string | null;
}) {
  const t = useTranslations('logging');
  return (
    <ScanResultHeader
      name={food.name}
      subtitle={subtitle}
      kcal={valueFor(food, 'calories', amount)}
      grams={{
        protein: valueFor(food, 'proteinGrams', amount),
        carbohydrate: valueFor(food, 'carbsGrams', amount),
        fat: valueFor(food, 'fatGrams', amount),
      }}
      labels={{
        protein: t('barcodeProtein'),
        carbohydrate: t('barcodeCarbs'),
        fat: t('barcodeFat'),
      }}
    />
  );
}

/**
 * A scan result's content — the same for a barcode product, a read label and
 * a food typed by hand (the Flutter app's `ScanResultBody`): the header, the
 * Portion / Amount card (with the cups for a drink's custom amount) and, when
 * the food carries them, the row into its other nutrients.
 */
export function ScanResultBody({
  food,
  amount,
  subtitle,
  disabled,
  onAmount,
  onOtherNutrients,
}: {
  food: ScanFood;
  amount: ScanAmount;
  subtitle: string | null;
  disabled: boolean;
  onAmount: (amount: ScanAmount) => void;
  onOtherNutrients: () => void;
}) {
  const t = useTranslations('logging.scan');
  const resolved = resolveScanAmount(amount, food);
  const { unit } = food;
  const sized = (size: number | null) =>
    size !== null && unit !== 'serving' ? formatSize(size, unit) : undefined;

  const choice = (portion: ScanPortion): ScanPortionChoice => {
    switch (portion) {
      case 'serving': {
        const size = sized(food.servingSize);
        return {
          value: portion,
          label: t('portionServing'),
          detail: size,
          display: size ? t('perServing', { size }) : t('portionServing'),
        };
      }
      case 'pack':
        return {
          value: portion,
          label: t('portionPack'),
          detail: sized(food.packageSize),
          display: t('portionPack'),
        };
      case 'custom':
        return {
          value: portion,
          label: t('portionCustom'),
          display: t('portionCustom'),
        };
    }
  };

  const count = (n: number, word: 'servings' | 'packs') => (
    <span className="text-[16px] text-kallo-text tabular-nums">
      {n} <span className="text-[14px]">{t(word, { count: n })}</span>
    </span>
  );
  const value =
    amount.portion === 'serving' ? (
      count(amount.servings, 'servings')
    ) : amount.portion === 'pack' ? (
      count(amount.packs, 'packs')
    ) : unit === 'serving' ? (
      count(Math.round(amount.custom), 'servings')
    ) : (
      <ScanAmountInput
        amount={Math.round(amount.custom)}
        unit={unit}
        label={t('amount')}
        disabled={disabled}
        onChange={(next) => onAmount(withCustom(amount, next))}
      />
    );

  return (
    <>
      <ScanFoodHeader food={food} amount={resolved} subtitle={subtitle} />
      <ScanAmountCard
        choices={portionsFor(food).map(choice)}
        selected={amount.portion}
        onSelect={(portion) => onAmount(withPortion(amount, food, portion))}
        amount={value}
        canDecrease={canStepScanAmount(amount, food, -1)}
        canIncrease={canStepScanAmount(amount, food, 1)}
        onStep={(direction) =>
          onAmount(stepScanAmount(amount, food, direction))
        }
        cups={
          amount.portion === 'custom' && unit === 'ml' ? (
            <ScanCupRow
              ml={Math.round(amount.custom)}
              label={t('amount')}
              disabled={disabled}
              onChange={(ml) => onAmount(withCustom(amount, ml))}
            />
          ) : undefined
        }
        disabled={disabled}
      />
      {hasOtherNutrients(food) && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOtherNutrients}
          className="mt-3 flex min-h-[52px] w-full items-center justify-between rounded-[22px] bg-white px-4 text-[16px] text-kallo-text"
        >
          {t('otherNutrients')}
          <ChevronRight className="size-4 text-kallo-text-muted" />
        </button>
      )}
    </>
  );
}
