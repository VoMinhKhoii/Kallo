'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  gramEnvelope,
  repointVesselTo,
  vesselAnchors,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { portionDisplay } from '@/components/logging/feed/meal-entry/portion/portion-display';
import { VesselTape } from '@/components/logging/feed/meal-entry/portion/tape/vessel-tape';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

interface MealEditSizeRowProps {
  vessel: ClientVessel;
  grams: number;
  onChange: (grams: number) => void;
}

/**
 * The Size row of a dish with a vessel, its vessel tape always open beneath it
 * (the owner's ruling: no tap to reach the vessels). It writes grams live, like
 * Amount, and the label follows the grams, so Servings and Amount move the size
 * it names too.
 */
export function MealEditSizeRow({
  vessel,
  grams,
  onChange,
}: MealEditSizeRowProps) {
  const t = useTranslations('logging.mealEdit');
  const tPortion = useTranslations('logging.portionPicker');
  const locale = useLocale();
  const loc = locale === 'vi' ? 'vi' : 'en';
  const rounded = Math.round(grams);
  const shown = repointVesselTo(vessel, rounded, locale);
  const { label } = portionDisplay(shown, rounded, loc);
  const anchors = vesselAnchors(shown, loc);
  const { min, max } = gramEnvelope(anchors);

  return (
    <div>
      <div className="flex min-h-[46px] items-center gap-2.5 font-sans-display text-kallo-text text-sm">
        <span>{t('size')}</span>
        <span className="min-w-0 flex-1 truncate text-right text-kallo-text-muted first-letter:uppercase">
          {label}
        </span>
      </div>
      {/* On a phone the dialog is a drawer: dragging the ruler must not drag
          the sheet. */}
      <div data-vaul-no-drag className="px-1 pt-1 pb-4">
        <VesselTape
          vessel={shown}
          anchors={anchors}
          grams={Math.min(max, Math.max(min, rounded))}
          min={min}
          max={max}
          label={tPortion('title')}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
