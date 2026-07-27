'use client';

import { useTranslations } from 'next-intl';
import { PortionContainerBody } from '@/components/logging/feed/meal-entry/portion-container-body';
import { PortionRuler } from '@/components/logging/feed/meal-entry/portion-ruler';
import {
  type ContainerFamily,
  isContainerFamily,
  type VesselFamily,
} from '@/lib/ai/portion/vessel-data';

export interface PortionAnchor {
  tier: number;
  value: number;
  label: string;
}

export function nearestAnchor(
  anchors: PortionAnchor[],
  grams: number
): PortionAnchor {
  return anchors.reduce((best, anchor) =>
    Math.abs(anchor.value - grams) < Math.abs(best.value - grams)
      ? anchor
      : best
  );
}

interface PortionPickerBodyProps {
  family: VesselFamily;
  /** Piece count (pieces only) — drives the "N ×" label prefix. */
  count?: number;
  /** Silhouette family for pieces (fish vs meat). */
  kind?: 'fish' | 'meat';
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
  family,
  count,
  kind,
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
  const isPiece = !isContainerFamily(family);
  const countPrefix = count && count > 1 ? `${count} × ` : '';

  // Pieces claim a tier only within ±10% of its value; otherwise "Custom".
  const claimed = isPiece
    ? (anchors.find((a) => Math.abs(grams - a.value) <= a.value * 0.1) ?? null)
    : null;
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

      {isPiece ? (
        <>
          <p className="mb-3 text-center text-nham-text tabular-nums">
            <span className="font-semibold text-lg">{grams} g</span>
            <span className="text-[13px] text-nham-text-muted">
              {' '}
              · {kcal} kcal
            </span>
          </p>
          <PortionRuler
            anchors={anchors}
            countPrefix={countPrefix}
            claimedTier={claimed?.tier ?? null}
            grams={grams}
            min={min}
            max={max}
            kind={kind ?? 'meat'}
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
          family={family as ContainerFamily}
          anchors={anchors}
          countPrefix={countPrefix}
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
          className="rounded-lg bg-nham-btn px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-nham-btn-hover"
        >
          {t('apply')}
        </button>
      </div>
    </div>
  );
}
