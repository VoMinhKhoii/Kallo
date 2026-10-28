'use client';

import { useLocale } from 'next-intl';
import {
  compositionFromGrams,
  type MacroGramsInput,
} from '@/components/shared/nutrition/composition';
import { CompositionBar } from '@/components/shared/nutrition/composition-bar';
import { MacroScale } from '@/components/shared/nutrition/macro-scale';
import { formatTime } from '@/lib/core/date/format-time';
import { capitalizeFirst } from '@/lib/core/text/capitalize';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';

interface DayMealBlockProps {
  label: string;
  calories: number;
  grams: MacroGramsInput;
}

/**
 * One meal the way the logging card reads it: the name, the composition bar,
 * then the macros with the kcal last. Mirrors mobile's
 * `MealBlock` with `MealBlockKcal.legendTrailing`.
 */
export function DayMealBlock({ label, calories, grams }: DayMealBlockProps) {
  const locale = useLocale();
  const composition = compositionFromGrams(grams);

  return (
    <div className="flex flex-col gap-2">
      <p className="line-clamp-2 font-medium text-[15px] text-kallo-text leading-[1.45]">
        {capitalizeFirst(label)}
      </p>
      {composition.totalKcal > 0 && (
        <CompositionBar segments={composition.segments} variant="compact" />
      )}
      <MacroScale
        grams={grams}
        trailing={
          <span className="font-medium font-sans-display text-[15px] text-kallo-text tabular-nums">
            {formatLocalizedNumber(calories, locale)} kcal
          </span>
        }
      />
    </div>
  );
}

/** The rule between meals, with the next meal's time in its middle. */
export function TimeDivider({ loggedAt }: { loggedAt: string }) {
  const locale = useLocale();
  return (
    <div className="flex items-center gap-3 text-kallo-text-muted text-xs tabular-nums">
      <span aria-hidden="true" className="h-px flex-1 bg-kallo-border/60" />
      <time dateTime={loggedAt}>{formatTime(loggedAt, locale)}</time>
      <span aria-hidden="true" className="h-px flex-1 bg-kallo-border/60" />
    </div>
  );
}
