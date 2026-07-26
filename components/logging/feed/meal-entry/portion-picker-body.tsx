'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { RulerSlider } from '@/components/shared/ruler-slider';
import { VESSEL_FAMILIES, type VesselTier } from '@/lib/ai/portion/vessel-data';

export interface PortionAnchor {
  tier: VesselTier;
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
  family: 'bowl' | 'plate' | 'cup';
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
  const nearest = nearestAnchor(anchors, grams);
  const tierMl = VESSEL_FAMILIES[family].tiers[nearest.tier].ml;
  const tier4Ml = VESSEL_FAMILIES[family].tiers[4].ml;
  // Bigger tier reads bigger: width scales by volume^(1/3), normalized to tier 4.
  const width = Math.round(140 * (Math.cbrt(tierMl) / Math.cbrt(tier4Ml)));

  return (
    <div className="font-sans-display">
      <h2 className="mb-3 font-semibold text-[13px] text-nham-text">
        {t('title')}
      </h2>

      <div className="mb-4 flex h-[140px] items-center justify-center">
        <Image
          src={`/portions/${VESSEL_FAMILIES[family].tiers[nearest.tier].asset}`}
          alt=""
          width={width}
          height={width}
          className="h-auto object-contain"
        />
      </div>

      <p className="mb-4 text-center text-nham-text tabular-nums">
        <span className="font-semibold text-lg">{grams} g</span>
        <span className="text-nham-text-muted"> · {kcal} kcal</span>
      </p>

      <RulerSlider
        min={min}
        max={max}
        value={grams}
        onChange={onChange}
        anchors={anchors}
        ariaLabel={t('title')}
      />

      <div className="mt-5 flex items-center justify-end gap-2">
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
