'use client';

import { PartyPopper } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CheatSliderRecap } from '@/components/groups/cheat/cheat-slider-recap';
import { compositionFromGrams } from '@/components/shared/nutrition/composition';
import { MacroScale } from '@/components/shared/nutrition/macro-scale';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';

/**
 * A shared CHEAT meal's numbers, as its own kind of post.
 *
 * Before this, a cheat occasion in the circle feed was indistinguishable from
 * a weighed bowl of phở: same composition bar, same exact kcal figure. That
 * quietly misrepresented it twice over — it claimed a precision the logger
 * never had, and it hid what the meal was actually made of.
 *
 * So this carries the owner card's vocabulary across: the badge, the `≈` that
 * marks the figure as a placement rather than a measurement, the alcohol the
 * P/C/F line structurally cannot hold, and where the sliders ended up.
 *
 * Deliberately NOT carried: the composition bar (a segmented bar reads as
 * measured proportions, which is the impression this is trying to undo) and
 * the reassurance line (that is the logger reassuring themselves — it is not
 * something a friend should be reading on someone else's post).
 */
export function CheatPostBody({ meal }: { meal: CircleFeedEntry['meal'] }) {
  const t = useTranslations('groups.feed');
  const tCard = useTranslations('logging.cheatMealCard');
  const locale = useLocale();

  const grams = {
    protein: meal.proteinG,
    carbohydrate: meal.carbohydrateG,
    fat: meal.fatG,
  };
  const hasNutrition =
    meal.caloriesKcal != null || compositionFromGrams(grams).totalKcal > 0;

  // The feed's own formatter, not the owner card's: cheat and precise posts
  // sit in one list, so a raw `1234` beside a localised `1.234` would read as
  // two different apps.
  const kcalLabel =
    meal.caloriesKcal == null
      ? '— kcal'
      : `≈ ${formatLocalizedNumber(meal.caloriesKcal, locale)} kcal`;

  return (
    <div className="mt-2 flex flex-col gap-1">
      <span className="flex w-fit items-center gap-1 rounded-full bg-kallo-accent/15 px-2 py-0.5 font-medium font-sans-display text-[10px] text-kallo-text">
        <PartyPopper className="h-3 w-3" />
        {tCard('badge')}
      </span>
      {hasNutrition && (
        <MacroScale
          grams={grams}
          leading={
            <span className="font-medium font-sans-display text-[15px] text-kallo-text tabular-nums">
              {kcalLabel}
            </span>
          }
        />
      )}
      {meal.alcoholG != null && meal.alcoholG > 0 && (
        <span className="font-sans-display text-[11.5px] text-kallo-text-muted tabular-nums">
          {t('alcohol', { grams: Math.round(meal.alcoholG) })}
        </span>
      )}
      {meal.cheatRecap && <CheatSliderRecap rows={meal.cheatRecap} />}
    </div>
  );
}
