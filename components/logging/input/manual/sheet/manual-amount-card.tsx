'use client';

import { Minus, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  buildContainerAnchors,
  buildPieceAnchors,
  claimedAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { ScanAmountInput } from '@/components/logging/input/scan/result/amount/input';
import { cn } from '@/lib/core/ui/cn';
import {
  MANUAL_GRAMS_MAX,
  MANUAL_GRAMS_MIN,
  manualRulerRange,
  steppedManualGrams,
  vesselFromHint,
} from '@/lib/domain/logging/manual-display';
import {
  formatKcal,
  type IngredientSearchResult,
} from '@/lib/domain/logging/manual-logging';
import { useStateWord } from './manual-food-row';
import { VesselTape } from './tape/vessel-tape';

const STEP =
  'flex size-8 items-center justify-center rounded-full bg-kallo-segment text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-40';

/**
 * The food page's card, read like the scan result's: what a row is on the
 * left, its value and control on the right. Weighed (only when the card names
 * a state), Amount ("120 kcal / 100 g" under it; − typed grams + with the
 * vessel the grams can claim), then the vessel tape. Mirrors the Flutter
 * `ManualAmountCard`.
 */
export function ManualAmountCard({
  food,
  grams,
  onGrams,
}: {
  food: IngredientSearchResult;
  grams: number;
  onGrams: (grams: number) => void;
}) {
  const t = useTranslations('logging.manualLogging');
  const stateWord = useStateWord();
  const loc = useLocale() === 'vi' ? 'vi' : 'en';
  const vessel = vesselFromHint(food.vessel);
  const anchors = vessel
    ? vessel.family === 'piece'
      ? buildPieceAnchors(vessel, loc)
      : buildContainerAnchors(vessel, loc)
    : null;
  const claimed = anchors ? claimedAnchor(anchors, Math.round(grams)) : null;
  const less = steppedManualGrams(grams, -1);
  const more = steppedManualGrams(grams, 1);
  const state = food.stateLabel;

  return (
    <section className="overflow-hidden rounded-[22px] bg-white">
      {state && (
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
          <span className="text-[16px] text-kallo-text">{t('weighed')}</span>
          <span className="text-[16px] text-kallo-text">
            {stateWord(state)}
          </span>
        </div>
      )}
      <div
        className={cn(
          'flex min-h-16 items-center justify-between gap-3 px-4',
          state && 'border-kallo-border border-t'
        )}
      >
        <div className="min-w-0">
          <p className="text-[16px] text-kallo-text">{t('amount')}</p>
          <p className="mt-0.5 text-[14px] text-kallo-text-muted">
            {t('kcalPer100Line', {
              kcal: formatKcal(food.per100g.caloriesKcal),
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t('decrease')}
            disabled={less === null}
            onClick={() => less !== null && onGrams(less)}
            className={STEP}
          >
            <Minus className="size-4" />
          </button>
          <div className="min-w-[76px] text-center">
            <ScanAmountInput
              amount={Math.round(grams)}
              unit="g"
              label={t('amountSlider')}
              disabled={false}
              onChange={(value) =>
                onGrams(
                  Math.min(MANUAL_GRAMS_MAX, Math.max(MANUAL_GRAMS_MIN, value))
                )
              }
            />
            {anchors && (
              <p className="truncate text-[12px] text-kallo-text-muted">
                {claimed?.label ?? t('customAmount')}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={t('increase')}
            disabled={more === null}
            onClick={() => more !== null && onGrams(more)}
            className={STEP}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      {vessel && anchors && (
        <div className="border-kallo-border border-t px-4 pt-2 pb-3">
          <VesselTape
            vessel={vessel}
            anchors={anchors}
            grams={Math.round(grams)}
            {...manualRulerRange(anchors.map((a) => a.value))}
            label={t('amountSlider')}
            onChange={onGrams}
          />
        </div>
      )}
    </section>
  );
}
