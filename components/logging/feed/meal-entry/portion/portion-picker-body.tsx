'use client';

import { useTranslations } from 'next-intl';
import { formatCaloriesValue } from '@/components/logging/feed/format-inline-nutrition';
import {
  claimedAnchor,
  type PortionAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { PortionContainerBody } from '@/components/logging/feed/meal-entry/portion/portion-container-body';
import { PortionRuler } from '@/components/logging/feed/meal-entry/portion/portion-ruler';
import type { ClientVessel } from '@/lib/ai/portion/vessel-types';

interface PortionPickerBodyProps {
  vessel: ClientVessel;
  anchors: PortionAnchor[];
  grams: number;
  min: number;
  max: number;
  kcal: number;
  onChange: (grams: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

/** Shared inner content for the portion picker (Drawer on phones, Popover ≥md). */
export function PortionPickerBody({
  vessel,
  anchors,
  grams,
  min,
  max,
  kcal,
  onChange,
  onApply,
  onCancel,
}: PortionPickerBodyProps) {
  const t = useTranslations('logging.portionPicker');
  const isPiece = vessel.family === 'piece';

  // Pieces claim a tier only within the claim band; otherwise "Custom".
  const claimed = isPiece ? claimedAnchor(anchors, grams) : null;
  const countPrefix =
    vessel.family === 'piece' && vessel.count > 1 ? `${vessel.count} × ` : '';
  const claimedName = claimed ? `${countPrefix}${claimed.label}` : null;
  const ariaValueText = claimedName
    ? `${grams} g — ${claimedName}`
    : `${grams} g`;

  return (
    <div className="font-sans-display">
      <h2
        className={`font-semibold text-[13px] text-nham-text ${isPiece ? 'mb-2' : 'mb-3'}`}
      >
        {t('title')}
      </h2>

      {vessel.family === 'piece' ? (
        <>
          <p className="mb-3 text-center text-nham-text tabular-nums">
            <span className="font-semibold text-lg">{grams} g</span>
            <span className="text-[13px] text-nham-text-muted">
              {' · '}
              {formatCaloriesValue(kcal)}
            </span>
          </p>
          <PortionRuler
            anchors={anchors}
            countPrefix={countPrefix}
            claimedTier={claimed?.tier ?? null}
            grams={grams}
            min={min}
            max={max}
            kind={vessel.kind}
            ariaLabel={t('title')}
            ariaValueText={ariaValueText}
            onChange={onChange}
          />
          <p className="mt-2 h-[18px] text-center text-[13px] text-nham-text-muted">
            {claimedName ? (
              <span className="font-semibold">{claimedName}</span>
            ) : (
              t('custom')
            )}
          </p>
        </>
      ) : (
        <PortionContainerBody
          family={vessel.family}
          anchors={anchors}
          grams={grams}
          min={min}
          max={max}
          kcal={kcal}
          onChange={onChange}
        />
      )}

      <div
        className={`flex items-center justify-end gap-2 ${isPiece ? 'mt-3' : 'mt-5'}`}
      >
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-nham-text-muted text-sm transition-colors hover:bg-nham-hover/50 hover:text-nham-text"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-nham-btn px-4 py-2 font-medium text-nham-surface text-sm transition-colors hover:bg-nham-btn-hover"
        >
          {t('apply')}
        </button>
      </div>
    </div>
  );
}
