'use client';

import { useTranslations } from 'next-intl';
import { type ScanFood, valueFor } from '@/lib/domain/scan/food';
import { SCAN_MICRONUTRIENT_DEFINITIONS } from '@/lib/domain/scan/nutrients';
import { formatFigure } from './header';

/** Whether `food` lists anything beyond calories and the three macros. */
export function hasOtherNutrients(food: ScanFood): boolean {
  return SCAN_MICRONUTRIENT_DEFINITIONS.some(
    ({ key }) => food.values[key] !== null
  );
}

/**
 * The result's second level — under the SAME header, so the product and its
 * macros stay in view: the nutrients for the chosen amount, one card. What the
 * source doesn't list is not shown: unknown is not 0.
 */
export function ScanOtherNutrients({
  food,
  amount,
  caption,
}: {
  food: ScanFood;
  amount: number;
  /** "In 1 serving · 100 ml". */
  caption: string;
}) {
  const t = useTranslations('logging');
  const rows = SCAN_MICRONUTRIENT_DEFINITIONS.flatMap((definition) => {
    const value = valueFor(food, definition.key, amount);
    return value === null ? [] : [{ ...definition, value }];
  });
  return (
    <section className="mt-5">
      <h3 className="px-4 pb-1.5 text-[14px] text-kallo-text-muted">
        {caption}
      </h3>
      <ul className="overflow-hidden rounded-[22px] bg-white">
        {rows.map(({ key, labelKey, unit, value }) => (
          <li
            key={key}
            className="flex min-h-[52px] items-center justify-between border-kallo-border not-first:border-t px-4"
          >
            <span className="text-[16px] text-kallo-text">
              {t(`ocrNutrients.${labelKey}`)}
            </span>
            <span className="text-[16px] text-kallo-text tabular-nums">
              {formatFigure(value)}{' '}
              <span className="text-[14px] text-kallo-text-muted">{unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
