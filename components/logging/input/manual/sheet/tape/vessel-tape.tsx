'use client';

import Image from 'next/image';
import {
  claimedAnchor,
  type PortionAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';
import { cn } from '@/lib/core/ui/cn';
import { useTapeInput } from './use-tape-input';
import {
  TAPE_COLUMN,
  tapeGlyphs,
  tapeScale,
  tapeTicks,
} from './vessel-tape-geometry';

/** The ruler band and the gap above it — the Flutter strip's numbers. */
const RULER = 22;
const NEEDLE_GAP = 6;

/**
 * A food's vessels on a tape measure — the iOS ruler (`PortionRulerStrip`),
 * on the phone sheets: the tape and its silhouettes scroll together under a
 * fixed centre needle. Drag the tape, tap a vessel to jump to it, or step one
 * graduation with the arrow keys; every label is in grams.
 */
export function VesselTape({
  vessel,
  anchors,
  grams,
  min,
  max,
  label,
  onChange,
}: {
  vessel: ClientVessel;
  anchors: PortionAnchor[];
  grams: number;
  min: number;
  max: number;
  /** The slider's accessible name. */
  label: string;
  onChange: (grams: number) => void;
}) {
  const { glyphs, band } = tapeGlyphs(vessel, anchors);
  const scale = tapeScale(anchors, min, max);
  const width = TAPE_COLUMN * anchors.length;
  const claimed = claimedAnchor(anchors, grams);
  const { fraction, dragging, handlers } = useTapeInput({
    anchors,
    scale,
    width,
    grams,
    onChange,
  });

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={grams}
      aria-valuetext={claimed ? `${grams} g — ${claimed.label}` : `${grams} g`}
      {...handlers}
      className="relative cursor-grab touch-none select-none overflow-hidden rounded-lg outline-none [mask-image:linear-gradient(90deg,transparent_0,#000_16%,#000_84%,transparent_100%)] focus-visible:ring-2 focus-visible:ring-kallo-accent/40"
      style={{ height: band + NEEDLE_GAP + RULER + 4 + 18 + 8 }}
    >
      <div
        className="absolute top-0 left-1/2"
        style={{
          width,
          transform: `translateX(${-fraction * width}px)`,
          transition: dragging
            ? 'none'
            : 'transform 280ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div className="relative" style={{ height: band }}>
          {glyphs.map((glyph, i) => (
            <span
              key={glyph.src}
              aria-hidden
              className={cn(
                'absolute bottom-0 transition-opacity',
                anchors[i].tier === claimed?.tier ? 'opacity-100' : 'opacity-50'
              )}
              style={{
                left: scale.centres[i] * width - glyph.width / 2,
                width: glyph.width,
                height: glyph.height,
              }}
            >
              <Image
                src={glyph.src}
                alt=""
                fill
                sizes="88px"
                draggable={false}
                className="pointer-events-none object-contain object-bottom"
              />
            </span>
          ))}
        </div>
        <div
          className="relative border-kallo-border border-t"
          style={{ height: RULER, marginTop: NEEDLE_GAP }}
        >
          {tapeTicks(anchors.length).map((tick) => (
            <span
              key={tick.x}
              className={cn(
                'absolute top-0',
                tick.major
                  ? 'w-[1.5px] bg-kallo-text/30'
                  : 'w-px bg-kallo-border'
              )}
              style={{ left: tick.x, height: tick.major ? RULER : 9 }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-[18px]">
          {anchors.map((anchor, i) => (
            <span
              key={anchor.tier}
              className={cn(
                'absolute text-center text-[14px] tabular-nums leading-[18px]',
                anchor.tier === claimed?.tier
                  ? 'text-kallo-text'
                  : 'text-kallo-text-muted'
              )}
              style={{
                left: scale.centres[i] * width - TAPE_COLUMN / 2,
                width: TAPE_COLUMN,
              }}
            >
              {Math.round(anchor.value)} g
            </span>
          ))}
        </div>
      </div>
      {/* The fixed reading mark: its cap inside the ruler band, its bar
          ending where the gram labels begin. */}
      <div
        aria-hidden
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
        style={{ top: band + NEEDLE_GAP }}
      >
        <span className="h-0 w-0 border-x-[4.5px] border-x-transparent border-t-[7px] border-t-kallo-btn" />
        <span
          className="w-0.5 rounded-[1px] bg-kallo-btn"
          style={{ height: RULER + 4 - 7 }}
        />
      </div>
    </div>
  );
}
