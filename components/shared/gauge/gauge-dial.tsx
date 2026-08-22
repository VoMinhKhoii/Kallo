'use client';

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';
import type { GaugeLine } from '@/components/shared/gauge/gauge-lines';
import { cn } from '@/lib/core/ui/cn';
import { gaugeHeight, gaugePaths } from '@/lib/core/ui/gauge-arc-geometry';
import {
  GAUGE_LINE_GAP,
  gaugeReadoutLayout,
} from '@/lib/core/ui/gauge-readout-layout';

/**
 * A gauge dial: the 240° arc with its figures nested in the mouth.
 *
 * This is the gauge module's entry point — callers want a dial, not an arc plus
 * a hand-positioned readout. Where the type sits against the arc is
 * `gaugeReadoutLayout`'s rule; this file's job is to paint it and to animate
 * the sweep.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/gauge_dial.dart`.
 */
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
  const center = { x: radius, y: radius };
  const filled = useTransform(
    sweep,
    (value) => gaugePaths(center, radius, value).filled
  );
  const remainder = useTransform(
    sweep,
    (value) => gaugePaths(center, radius, value).remainder
  );

  // The readout is a fixed stack of ROLES, not a list of data — which is also
  // what each line is keyed by.
  const lines = [
    { role: 'primary', line: primary },
    { role: 'secondary', line: secondary },
    ...(tertiary ? [{ role: 'tertiary', line: tertiary }] : []),
  ];
  const layout = gaugeReadoutLayout(
    radius,
    lines.map(({ line }) => line.heightPx)
  );
  const arcHeight = gaugeHeight(radius);

  return (
    <div
      className="relative flex shrink-0 flex-col items-center"
      style={{
        // The READOUT sizes the dial and the arc is painted behind it, so a
        // line wider than the mark widens the box instead of spilling out of
        // it.
        minWidth: radius * 2,
        minHeight: layout.height,
      }}
    >
      <svg
        aria-hidden="true"
        className="absolute"
        height={arcHeight}
        style={{ top: layout.arcTop }}
        viewBox={`0 0 ${radius * 2} ${arcHeight}`}
        width={radius * 2}
      >
        <motion.path d={remainder} fill="var(--kallo-track)" />
        <motion.path d={filled} fill={fill} />
      </svg>
      <div
        className="flex flex-col items-center"
        style={{ paddingTop: layout.readoutTop, gap: GAUGE_LINE_GAP }}
      >
        {lines.map(({ role, line }) => (
          <span
            className={cn('whitespace-nowrap', line.className)}
            key={role}
            style={{ lineHeight: `${line.heightPx}px` }}
          >
            {line.text}
          </span>
        ))}
      </div>
    </div>
  );
}
