'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { scalePer100 } from '@/lib/domain/barcode/amount';
import {
  BARCODE_MICRONUTRIENT_KEYS,
  type ParsedBarcodeProduct,
} from '@/lib/domain/barcode/types';
import { NUTRIENT_META } from '@/lib/domain/nutrition/catalog/nutrients';
import type { NutritionNutrientKey } from '@/lib/domain/nutrition/types';

/** Fiber and sodium first, as the label prints them, then the rest. */
const PREMIUM_KEYS: readonly NutritionNutrientKey[] = [
  'fiberG',
  'sodiumMg',
  ...BARCODE_MICRONUTRIENT_KEYS,
];

function perHundred(
  product: ParsedBarcodeProduct,
  key: NutritionNutrientKey
): number | null {
  if (key === 'fiberG') return product.fiberG;
  if (key === 'sodiumMg') return product.sodiumMg;
  return product.micronutrients?.[key] ?? null;
}

/**
 * The label's other nutrients, scaled to the chosen amount, behind a
 * disclosure like the label scan's. Premium: the server sends
 * `micronutrients: null` to a viewer without it, and then this renders
 * nothing. The figures are saved with the meal either way.
 */
export function BarcodeMicronutrients({
  product,
  amount,
}: {
  product: ParsedBarcodeProduct;
  amount: number;
}) {
  const t = useTranslations('logging');
  const tRoot = useTranslations();
  const [open, setOpen] = useState(false);

  if (product.micronutrients === null) return null;
  const rows = PREMIUM_KEYS.flatMap((key) => {
    const value = scalePer100(perHundred(product, key), amount, 1);
    return value === null ? [] : [{ key, value, meta: NUTRIENT_META[key] }];
  });
  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-[#EAE7E0] border-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center justify-between font-sans-display text-[13px] text-kallo-text-muted"
      >
        {t('ocrMicronutrients', { count: rows.length })}
        <ChevronDown
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-1">
          {rows.map(({ key, value, meta }) => (
            <div key={key} className="flex items-baseline justify-between">
              <dt className="font-sans-display text-[#8B8682] text-[13px]">
                {tRoot(meta.labelKey)}
              </dt>
              <dd className="font-sans-display text-[13px] text-kallo-text tabular-nums">
                {value} {meta.unit}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
