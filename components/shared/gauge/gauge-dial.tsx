'use client';

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';
import {
  gaugeHeight,
  gaugePaths,
  gaugeTipOffset,
} from '@/lib/core/ui/gauge-arc-geometry';

/**
 * A gauge dial: the 240° arc with its figures nested in the mouth.
 *
 * This is the gauge module's entry point — callers want a dial, not an arc plus
 * a hand-positioned readout. It owns the one alignment rule the app's dials
 * share: the SECOND line's middle sits on the arc's tips, so the type and the
 * arc read as a single object rather than a number parked near a shape.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/gauge_dial.dart`.
 */

/**
 * One line of a dial's readout.
 *
 * `heightPx` is not decoration: the placement below measures the stack before
 * it draws it, and the line is rendered at exactly this line-height so the
 * measurement cannot disagree with what the browser lays out.
 */
export interface GaugeLine {
  text: string;
  className: string;
  heightPx: number;
}

/**
 * The four readout lines the app's dials draw, each pairing its classes with
 * the height they resolve to. Stated together because the placement arithmetic
 * needs the number and the browser needs the classes — split them and they
 * drift.
 */
export const GAUGE_LINES = {
  /** The dashboard's one hero figure per card. */
  hero: {
    className: 'font-sans-display text-hero text-kallo-text',
    heightPx: 44,
  },
  /** The embedded dial's headline, and the macro dials' gram figure. */
  value: {
    className: 'font-sans-display font-semibold text-kallo-text text-sm',
    heightPx: 20,
  },
  /** What the headline is — the line that lands on the tips. */
  body: {
    className: 'font-sans-display text-kallo-text-muted text-sm',
    heightPx: 20,
  },
  /** The quiet detail under the arc, and the macro dials' `/target`. */
  meta: {
    className: 'font-sans-display text-kallo-text-muted text-xs',
    heightPx: 16,
  },
} as const;

/** Build a readout line from one of the named styles above. */
export function gaugeLine(
  style: keyof typeof GAUGE_LINES,
  text: string
): GaugeLine {
  return { ...GAUGE_LINES[style], text };
}

/** The gap between the readout's stacked lines. */
const LINE_GAP = 2;

interface GaugeDialProps {
  /** Consumed ÷ target. Over 1 the arc simply reads full. */
  progress: number;
  radius: number;
  /** A CSS colour — the mark's own pigment, never a state colour. */
  fill: string;
  /** The headline figure. */
  primary: GaugeLine;
  /** What the headline is — the line that lands on the arc's tips. */
  secondary: GaugeLine;
  /** An optional third line, which hangs below the arc. */
  tertiary?: GaugeLine;
}

export function GaugeDial({
  progress,
  radius,
  fill,
  primary,
  secondary,
  tertiary,
}: GaugeDialProps) {
  const prefersReducedMotion = useReducedMotion();
  const target = Number.isFinite(progress) ? Math.max(progress, 0) : 0;
  const sweep = useMotionValue(prefersReducedMotion ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      sweep.set(target);
      return;
    }
    // The sweep replays from empty whenever the figure changes, as the Flutter
    // arc does — the day filling up is the animation, not a needle nudging.
    sweep.set(0);
    const controls = animate(sweep, target, {
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [prefersReducedMotion, sweep, target]);

  // The path changes SHAPE with the sweep, so there is nothing for the browser
  // to interpolate — a scalar is animated and the two paths are derived from it
  // each frame, off the React render path.
  const filled = useTransform(
    sweep,
    (value) => gaugePaths({ x: radius, y: radius }, radius, value).filled
  );
  const remainder = useTransform(
    sweep,
    (value) => gaugePaths({ x: radius, y: radius }, radius, value).remainder
  );

  const lines = [primary, secondary, ...(tertiary ? [tertiary] : [])];
  const readoutHeight =
    lines.reduce((sum, line) => sum + line.heightPx, 0) +
    LINE_GAP * (lines.length - 1);
  // Where the readout wants to start for its SECOND line to land on the tips.
  const wanted =
    radius +
    gaugeTipOffset(radius) -
    secondary.heightPx / 2 -
    LINE_GAP -
    primary.heightPx;
  // A small dial with tall lines wants to start ABOVE its own arc. Rather than
  // clip the headline or quietly break the alignment, the ARC drops by the
  // shortfall and the readout starts at 0: the two still share the tip line,
  // and the dial simply reserves the extra height.
  const arcTop = wanted < 0 ? -wanted : 0;
  const readoutTop = wanted + arcTop;
  const arcHeight = gaugeHeight(radius);

  return (
    <div
      className="relative flex shrink-0 flex-col items-center"
      style={{
        // The READOUT sizes the dial and the arc is painted behind it, so a
        // line wider than the mark widens the box instead of spilling out of
        // it. The last line can also hang below the arc, so the dial's own
        // height is not always the whole of it.
        minWidth: radius * 2,
        minHeight: Math.max(arcTop + arcHeight, readoutTop + readoutHeight),
      }}
    >
      <svg
        aria-hidden="true"
        className="absolute"
        height={arcHeight}
        style={{ top: arcTop }}
        viewBox={`0 0 ${radius * 2} ${arcHeight}`}
        width={radius * 2}
      >
        <motion.path d={remainder} fill="var(--kallo-track)" />
        <motion.path d={filled} fill={fill} />
      </svg>
      <div
        className="flex flex-col items-center"
        style={{ paddingTop: readoutTop, gap: LINE_GAP }}
      >
        {lines.map((line) => (
          <span
            className={`${line.className} whitespace-nowrap tabular-nums`}
            key={line.text}
            style={{ lineHeight: `${line.heightPx}px` }}
          >
            {line.text}
          </span>
        ))}
      </div>
    </div>
  );
}
