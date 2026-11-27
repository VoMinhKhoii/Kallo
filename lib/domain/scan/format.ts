import {
  formatServingValue,
  servingPluralCount,
} from '@/lib/domain/meals/serving-ladder';
import type { OcrQuantityUnit } from '@/lib/domain/nutrition/ocr/schema';

/** Compact logged amount for `rawInput` titles on staged barcode/label meals,
 *  so `1/3` serving or `33.3333...ml` never prints raw float tails. */
export function formatRawLoggedAmount(
  amount: number,
  unit: OcrQuantityUnit
): string {
  if (unit === 'serving') {
    const word = servingPluralCount(amount) === 1 ? 'serving' : 'servings';
    return `${formatServingValue(amount, 'en')} ${word}`;
  }
  return `${Math.round(amount * 100) / 100}${unit}`;
}
