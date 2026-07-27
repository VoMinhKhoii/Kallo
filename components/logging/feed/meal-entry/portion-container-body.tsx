'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  nearestAnchor,
  type PortionAnchor,
} from '@/components/logging/feed/meal-entry/portion-picker-body';
import { PortionSlider } from '@/components/logging/feed/meal-entry/portion-slider';
import {
  type ContainerFamily,
  VESSEL_FAMILIES,
  type VesselTier,
} from '@/lib/ai/portion/vessel-data';

interface PortionContainerBodyProps {
  family: ContainerFamily;
  anchors: PortionAnchor[];
  countPrefix: string;
  grams: number;
  min: number;
  max: number;
  kcal: number;
  onChange: (grams: number) => void;
}

/**
 * Container layout: a true-to-scale glyph row whose heights scale as
 * cbrt(volume) (tap to jump to a tier), the nearest-tier label, the live
 * gram/kcal readout, and a plain fine-adjustment slider. Unchanged from the
 * pre-redesign picker — the redesign only reshaped the piece branch.
 */
export function PortionContainerBody({
  family,
  anchors,
  countPrefix,
  grams,
  min,
  max,
  kcal,
  onChange,
}: PortionContainerBodyProps) {
  const t = useTranslations('logging.portionPicker');
  const glyphs = anchors.map((anchor) => {
    const tier = VESSEL_FAMILIES[family].tiers[anchor.tier as VesselTier];
    return {
      asset: tier.asset,
      aspect: tier.aspect,
      sizeLabel: tier.sizeLabel,
      ml: tier.ml,
    };
  });
  const largestMl = glyphs.at(-1)?.ml ?? 1;
  const nearest = nearestAnchor(anchors, grams);
  const nearestIndex = anchors.findIndex((a) => a.tier === nearest.tier);
  const nearestGlyph = glyphs[nearestIndex] ?? glyphs[0];
  const nearestLabel = `${countPrefix}${nearest.label}`;
  const ariaValueText = `${grams} g — ${nearestLabel} (${nearestGlyph?.sizeLabel})`;

  return (
    <>
      <div className="mx-auto mb-4 flex w-full max-w-[340px] items-end justify-center gap-2">
        {anchors.map((anchor, index) => {
          const glyph = glyphs[index];
          const selected = anchor.tier === nearest.tier;
          const weight = Math.cbrt(glyph.ml / largestMl) * glyph.aspect;
          return (
            <button
              key={anchor.tier}
              type="button"
              onClick={() => onChange(anchor.value)}
              aria-label={`${countPrefix}${anchor.label} (${glyph.sizeLabel})`}
              aria-pressed={selected}
              style={{ flex: `${weight} 1 0%` }}
              className={`flex flex-col items-center transition-opacity ${
                selected ? 'opacity-100' : 'opacity-45 hover:opacity-75'
              }`}
            >
              <div
                className="relative w-full"
                style={{ aspectRatio: glyph.aspect }}
              >
                <Image
                  src={`/portions/${glyph.asset}`}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-contain object-bottom"
                />
              </div>
              <span
                className={`mt-1 h-0.5 w-6 rounded-full transition-colors ${
                  selected ? 'bg-nham-accent' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>
      <p className="mb-1 text-center text-[13px] text-nham-text-muted">
        {nearestLabel} · {nearestGlyph?.sizeLabel}
      </p>
      <p className="mb-4 text-center text-nham-text tabular-nums">
        <span className="font-semibold text-lg">{grams} g</span>
        <span className="text-[13px] text-nham-text-muted"> · {kcal} kcal</span>
      </p>
      <PortionSlider
        grams={grams}
        min={min}
        max={max}
        ariaLabel={t('title')}
        ariaValueText={ariaValueText}
        onChange={onChange}
      />
    </>
  );
}
