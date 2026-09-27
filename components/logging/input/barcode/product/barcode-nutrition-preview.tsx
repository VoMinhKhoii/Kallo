'use client';

import { useTranslations } from 'next-intl';
import { BarcodeMicronutrients } from '@/components/logging/input/barcode/product/barcode-micronutrients';
import { scalePer100 } from '@/lib/domain/barcode/amount';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';

/**
 * Nutrition for the chosen amount — the calorie figure with a tabular macro
 * row underneath, then the label's other nutrients for Premium. Scaled from
 * the product's per-100 values, so it is per-amount, not per-100.
 */
export function BarcodeNutritionPreview({
  product,
  amount,
}: {
  product: ParsedBarcodeProduct;
  /** In the product's own unit. */
  amount: number;
}) {
  const t = useTranslations('logging');
  const calories = scalePer100(product.caloriesKcal, amount, 0);
  const macros = [
    {
      label: t('barcodeProtein'),
      value: scalePer100(product.proteinG, amount, 1),
    },
    {
      label: t('barcodeCarbs'),
      value: scalePer100(product.carbohydrateG, amount, 1),
    },
    { label: t('barcodeFat'), value: scalePer100(product.fatG, amount, 1) },
  ];

  return (
    <div className="rounded-[20px] border border-[#EAE7E0] bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans-display text-[#8B8682] text-[12px]">
          {t('barcodeNutritionForAmount', {
            amount,
            unit: product.amountUnit,
          })}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="font-normal font-sans-display text-[26px] text-kallo-text tabular-nums leading-none">
            {calories !== null ? calories : '--'}
          </span>
          <span className="font-sans-display text-[#8B8682] text-[12px]">
            kcal
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-[#EAE7E0] border-t pt-3">
        {macros.map((macro) => (
          <div key={macro.label} className="text-center">
            <span className="block font-medium font-sans-display text-[#8B8682] text-[10px] uppercase tracking-wide">
              {macro.label}
            </span>
            <span className="mt-0.5 block font-sans-display font-semibold text-[15px] text-kallo-text tabular-nums">
              {macro.value !== null ? `${macro.value}g` : '--'}
            </span>
          </div>
        ))}
      </div>
      <BarcodeMicronutrients product={product} amount={amount} />
    </div>
  );
}
