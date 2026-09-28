'use client';

import Image from 'next/image';
import { useLocale } from 'next-intl';
import {
  gramEnvelope,
  nearestAnchor,
  type PortionAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { PortionSlider } from '@/components/logging/feed/meal-entry/portion/portion-slider';
import {
  VESSEL_FAMILIES,
  type VesselTier,
} from '@/lib/ai/portion/data/vessel-tables';
import { cn } from '@/lib/core/ui/cn';

const TIERS: VesselTier[] = [1, 2, 3, 4];
const CUPS = VESSEL_FAMILIES.cup.tiers;
const LARGEST_ML = CUPS[4].ml;

/** The tallest cup's height, px — the approved canvas's band. */
const BAND = 74;

/**
 * The meal card's cups, for a drink's custom amount — its glyph row (heights
 * by the cube root of volume, a click jumps to a cup) over its fine slider.
 * No caption: the Amount row above already says the number.
 */
export function ScanCupRow({
  ml,
  label,
  disabled,
  onChange,
}: {
  ml: number;
  /** The slider's accessible name ("Amount"). */
  label: string;
  /** While saving: the amount being saved must not move. */
  disabled: boolean;
  onChange: (ml: number) => void;
}) {
  const loc = useLocale() === 'vi' ? 'vi' : 'en';
  const anchors: PortionAnchor<VesselTier>[] = TIERS.map((tier) => ({
    tier,
    value: CUPS[tier].ml,
    label: CUPS[tier].label[loc],
  }));
  const { min, max } = gramEnvelope(anchors);
  const nearest = nearestAnchor(anchors, ml);

  return (
    // Inert while saving: no click, drag, focus or screen-reader change.
    <div inert={disabled} className={cn(disabled && 'opacity-60')}>
      <div className="flex items-end justify-around gap-2">
        {anchors.map((anchor) => {
          const cup = CUPS[anchor.tier];
          const height = BAND * Math.cbrt(cup.ml / LARGEST_ML);
          const selected = anchor.tier === nearest.tier;
          return (
            <button
              key={anchor.tier}
              type="button"
              aria-label={`${anchor.label} (${cup.sizeLabel})`}
              aria-pressed={selected}
              onClick={() => onChange(anchor.value)}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  'relative block transition-opacity',
                  selected ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                )}
                style={{ height, width: height * cup.aspect }}
              >
                <Image
                  src={`/portions/${cup.asset}`}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain object-bottom"
                />
              </span>
              <span className="text-[14px] text-kallo-text-muted tabular-nums">
                {cup.sizeLabel}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <PortionSlider
          grams={Math.min(max, Math.max(min, ml))}
          min={min}
          max={max}
          ariaLabel={label}
          ariaValueText={`${ml} ml — ${nearest.label}`}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
