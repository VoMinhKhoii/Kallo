'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import {
  type EditDish,
  floorOf,
  isScalable,
  type MealEditDraft,
  removesOnMinus,
  servingsMinusDisabled,
  servingsOf,
  setDishGrams,
  stepAmount,
  stepServings,
  sumTotals,
} from '@/lib/domain/meals/meal-edit/meal-edit-draft';
import { MealEditSizeRow } from './meal-edit-size-row';
import { MealEditStepperRow } from './meal-edit-stepper-row';

interface MealEditDishProps {
  draft: MealEditDraft;
  dish: EditDish;
  /** The dish the card opened the dialog onto: scrolled to on open. */
  openedOn: boolean;
  onDraft: (next: MealEditDraft) => void;
}

/**
 * One dish in the edit dialog: its name and calories, then Servings, Amount
 * and — when the pipeline pictured it in a vessel — Size. No ingredient rows:
 * a dish scales as one thing (the owner's ruling).
 */
export function MealEditDish({
  draft,
  dish,
  openedOn,
  onDraft,
}: MealEditDishProps) {
  const t = useTranslations('logging.mealEdit');
  const sectionRef = useRef<HTMLElement>(null);
  // It may sit below the first screenful, or tapping "≈ medium bowl" would
  // land on the summary.
  useEffect(() => {
    if (openedOn) sectionRef.current?.scrollIntoView({ block: 'start' });
  }, [openedOn]);
  const locale = useLocale();
  const named = { name: dish.name };
  const removes = removesOnMinus(draft, dish);
  const scalable = isScalable(dish);
  const kcal = sumTotals([dish]).kcal;
  const times = `${formatLocalizedNumber(Math.round(servingsOf(dish) * 10) / 10, locale)}×`;

  return (
    <section ref={sectionRef} className="scroll-mt-4 font-sans-display">
      <div className="mx-0.5 mt-4 mb-1.5 flex items-baseline gap-3 text-sm">
        <h3 className="min-w-0 flex-1 truncate font-medium text-kallo-text">
          {dish.name}
        </h3>
        <span className="text-kallo-text-muted tabular-nums">
          {kcal == null
            ? '—'
            : `${formatLocalizedNumber(Math.round(kcal), locale)} kcal`}
        </span>
      </div>
      <div className="divide-y divide-kallo-border overflow-hidden rounded-xl border border-kallo-border/60 bg-card px-3.5">
        <MealEditStepperRow
          label={t('servings')}
          value={times}
          minusRemoves={removes}
          minusLabel={
            removes ? t('removeDish', named) : t('lessServing', named)
          }
          plusLabel={t('moreServing', named)}
          onMinus={
            servingsMinusDisabled(draft, dish)
              ? undefined
              : () => onDraft(stepServings(draft, dish.key, -1))
          }
          onPlus={
            scalable
              ? () => onDraft(stepServings(draft, dish.key, 1))
              : undefined
          }
        />
        {scalable && (
          <MealEditStepperRow
            label={t('amount')}
            value={`${formatLocalizedNumber(Math.round(dish.grams), locale)} ${dish.unit}`}
            minusLabel={t('lessAmount', named)}
            plusLabel={t('moreAmount', named)}
            onMinus={
              dish.grams <= floorOf(dish)
                ? undefined
                : () => onDraft(stepAmount(draft, dish.key, -1))
            }
            onPlus={() => onDraft(stepAmount(draft, dish.key, 1))}
          />
        )}
        {scalable && dish.vessel && (
          <MealEditSizeRow
            vessel={dish.vessel}
            grams={dish.grams}
            onChange={(grams) => onDraft(setDishGrams(draft, dish.key, grams))}
          />
        )}
      </div>
    </section>
  );
}
