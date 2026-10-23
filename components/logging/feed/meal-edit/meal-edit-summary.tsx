'use client';

import { useLocale } from 'next-intl';
import { compositionFromGrams } from '@/components/shared/nutrition/composition';
import { CompositionBar } from '@/components/shared/nutrition/composition-bar';
import { MacroScale } from '@/components/shared/nutrition/macro-scale';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import type { EditTotals } from '@/lib/domain/meals/meal-edit/meal-edit-draft';

/**
 * The whole meal at the top of the edit dialog: its calories as one large
 * figure, then the calorie-share bar and the macro legend under it.
 *
 * Sans, not Lora: the serif is for titles and the editorial italic, never for
 * a number (the owner's ruling on this dialog).
 */
export function MealEditSummary({ totals }: { totals: EditTotals }) {
  const locale = useLocale();
  const grams = {
    protein: totals.protein,
    carbohydrate: totals.carbs,
    fat: totals.fat,
  };
  const composition = compositionFromGrams(grams);
  const round = (v: number | null) => (v == null ? null : Math.round(v));
  const rounded = {
    protein: round(totals.protein),
    carbohydrate: round(totals.carbs),
    fat: round(totals.fat),
  };
  return (
    <div className="font-sans-display">
      <p className="mt-1 mb-3.5 text-center text-kallo-text tabular-nums">
        <span className="text-[40px] leading-none tracking-tight">
          {totals.kcal == null
            ? '—'
            : formatLocalizedNumber(Math.round(totals.kcal), locale)}
        </span>
        <span className="ml-1 text-kallo-text-muted text-sm">kcal</span>
      </p>
      {composition.totalKcal > 0 && (
        <CompositionBar segments={composition.segments} variant="compact" />
      )}
      <MacroScale grams={rounded} spread="columns" className="mt-2" />
    </div>
  );
}
