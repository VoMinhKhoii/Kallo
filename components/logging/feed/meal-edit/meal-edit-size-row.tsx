'use client';

import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { portionDisplay } from '@/components/logging/feed/meal-entry/portion/portion-display';
import {
  PortionPicker,
  repointVesselTo,
} from '@/components/logging/feed/meal-entry/portion/portion-picker';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

interface MealEditSizeRowProps {
  vessel: ClientVessel;
  grams: number;
  kcal: number;
  onApply: (grams: number, vessel: ClientVessel) => void;
}

/**
 * The Size row of a dish with a vessel. It opens the portion picker as a
 * popover anchored to the row (a drawer on phones) — the owner kept the
 * popover for web. The label follows the grams, so Servings and Amount moving
 * the dish move the size it names too.
 */
export function MealEditSizeRow({
  vessel,
  grams,
  kcal,
  onApply,
}: MealEditSizeRowProps) {
  const t = useTranslations('logging.mealEdit');
  const locale = useLocale();
  const loc = locale === 'vi' ? 'vi' : 'en';
  const shown = repointVesselTo(vessel, Math.round(grams), locale);
  const { label } = portionDisplay(shown, Math.round(grams), loc);

  return (
    <PortionPicker
      vessel={shown}
      grams={Math.round(grams)}
      kcal={kcal}
      onApply={onApply}
      trigger={
        <button
          type="button"
          className="-mx-3.5 flex min-h-[46px] w-[calc(100%+1.75rem)] items-center gap-2.5 px-3.5 text-left font-sans-display text-kallo-text text-sm transition-colors hover:bg-kallo-hover/40"
        >
          <span>{t('size')}</span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-kallo-text-muted">
            <span className="truncate first-letter:uppercase">{label}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          </span>
        </button>
      }
    />
  );
}
