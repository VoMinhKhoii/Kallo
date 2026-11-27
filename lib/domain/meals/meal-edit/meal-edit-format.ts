import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import { MIN_DISH_GRAMS } from '@/lib/domain/meals/quantity-recalculation';

/**
 * Grams or millilitres for the Edit Meal Amount row: whole grouped figures at
 * or above `MIN_DISH_GRAMS` (`1,250 g`, `350 ml`), and up to one decimal under
 * `MIN_DISH_GRAMS` (`2.5 g`) so a small dish scaled down never reads `0 g`.
 * Dart twin: `formatAmount` in `meal_edit_format.dart`.
 */
export function formatEditAmount(
  grams: number,
  unit: 'g' | 'ml',
  locale: string
): string {
  const figure =
    grams >= MIN_DISH_GRAMS
      ? formatLocalizedNumber(Math.round(grams), locale)
      : formatLocalizedNumber(Math.round(grams * 10) / 10, locale);
  return `${figure} ${unit}`;
}
