'use client';

import Image from 'next/image';
import { Slider as SliderPrimitive } from 'radix-ui';
import type { PortionAnchor } from '@/components/logging/feed/meal-entry/portion-picker-body';
import { PIECE_TIERS, pieceAssetFor } from '@/lib/ai/portion/vessel-data';
import type { PieceVessel } from '@/lib/ai/portion/vessel-types';

/** Fixed track positions (%) for the five tier anchors — equal visual spacing. */
const ANCHOR_POSITIONS = [10, 30, 50, 70, 90] as const;
/** Slider operates in integer position space; grams map piecewise over it. */
const POSITION_MAX = 1000;
const POSITION_BREAKS = [0, 100, 300, 500, 700, 900, 1000] as const;

const MIN_GLYPH_PX = 20;
const MAX_GLYPH_PX = 60;
const CBRT_MIN = Math.cbrt(PIECE_TIERS[0].grams);
const CBRT_MAX = Math.cbrt(PIECE_TIERS[PIECE_TIERS.length - 1].grams);

/** Silhouette height grows as cbrt(per-piece grams), clamped so tier 1 stays
 * recognizable and tier 5 never dominates. Count-independent by design. */
function glyphHeight(grams: number): number {
  const t = (Math.cbrt(grams) - CBRT_MIN) / (CBRT_MAX - CBRT_MIN);
  return MIN_GLYPH_PX + t * (MAX_GLYPH_PX - MIN_GLYPH_PX);
}

/** Piecewise-linear interpolation of `x` from the `xs` domain onto `ys`. */
function interp(
  x: number,
  xs: readonly number[],
  ys: readonly number[]
): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i += 1) {
    if (x <= xs[i + 1]) {
      const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + f * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

interface PortionRulerProps {
  anchors: PortionAnchor[];
  /** "N × " prefix (blank for a single piece). */
  countPrefix: string;
  /** Tier claimed by the ±10% rule, or null when the portion is custom. */
  claimedTier: number | null;
  grams: number;
  min: number;
  max: number;
  kind: PieceVessel['kind'];
  ariaLabel: string;
  ariaValueText: string;
  onChange: (grams: number) => void;
}

/**
 * Integrated piece ruler: one continuous track with five equal-spaced anchors.
 * Each anchor carries a bottom-aligned silhouette above the track, a 1px tick
 * on it, and a gram label below — all sharing one column. The Radix slider runs
 * in position space (0–1000); grams map to/from it piecewise-linearly over the
 * breakpoints (0%,min) (10%,a1) (30%,a2) (50%,a3) (70%,a4) (90%,a5) (100%,max),
 * so anchors sit at fixed positions while grams stay continuous between them.
 */
export function PortionRuler({
  anchors,
  countPrefix,
  claimedTier,
  grams,
  min,
  max,
  kind,
  ariaLabel,
  ariaValueText,
  onChange,
}: PortionRulerProps) {
  const gramBreaks = [min, ...anchors.map((a) => a.value), max];
  const positionToGrams = (position: number) =>
    Math.round(interp(position, POSITION_BREAKS, gramBreaks));
  const gramsToPosition = (value: number) =>
    Math.round(interp(value, gramBreaks, POSITION_BREAKS));

  const position = gramsToPosition(grams);
  // Guarantee each arrow key press nudges grams by at least ~1 g.
  const step = Math.max(1, Math.round(POSITION_MAX / (max - min)));

  return (
    <div>
      <div className="relative mb-1 h-[64px]">
        {anchors.map((anchor, index) => {
          const tier = PIECE_TIERS[anchor.tier - 1];
          const asset = pieceAssetFor(tier, kind);
          const height = Math.round(glyphHeight(tier.grams));
          const selected = anchor.tier === claimedTier;
          return (
            <button
              key={anchor.tier}
              type="button"
              onClick={() => onChange(anchor.value)}
              aria-label={`${countPrefix}${anchor.label} (${tier.sizeLabel})`}
              aria-pressed={selected}
              style={{ left: `${ANCHOR_POSITIONS[index]}%` }}
              className={`absolute bottom-0 flex -translate-x-1/2 items-end justify-center transition-opacity ${
                selected ? 'opacity-100' : 'opacity-50 hover:opacity-80'
              }`}
            >
              <div
                className="relative"
                style={{ width: Math.round(height * asset.aspect), height }}
              >
                <Image
                  src={`/portions/${asset.file}`}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain object-bottom"
                />
              </div>
            </button>
          );
        })}
      </div>

      <SliderPrimitive.Root
        min={0}
        max={POSITION_MAX}
        step={step}
        value={[position]}
        onValueChange={(values) => onChange(positionToGrams(values[0] ?? 0))}
        aria-label={ariaLabel}
        className="relative flex h-4 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-nham-border/50">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-nham-text/30" />
          {ANCHOR_POSITIONS.map((pos) => (
            <span
              key={`tick-${pos}`}
              className="absolute top-0 h-full w-px bg-nham-text/25"
              style={{ left: `${pos}%` }}
            />
          ))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-valuetext={ariaValueText}
          className="block size-4 shrink-0 rounded-full border border-nham-text/30 bg-white shadow-sm outline-hidden transition-[box-shadow] hover:ring-4 hover:ring-nham-text/10 focus-visible:ring-4 focus-visible:ring-nham-accent/30"
        />
      </SliderPrimitive.Root>

      <div className="relative mt-2 h-[14px]">
        {anchors.map((anchor, index) => (
          <span
            key={`label-${anchor.tier}`}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-nham-text-muted tabular-nums"
            style={{ left: `${ANCHOR_POSITIONS[index]}%` }}
          >
            {anchor.value} g
          </span>
        ))}
      </div>
    </div>
  );
}
