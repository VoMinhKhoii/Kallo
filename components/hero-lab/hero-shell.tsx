'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { CommandBar, DemoChips } from '@/components/landing-lab/command-bar';
import { DerivationCard } from '@/components/landing-lab/derivation-card';
import { type LabDemo, useLabDemo } from '@/hooks/landing-lab/use-demo';
import { HERO_COPY } from './copy';
import { HeroHeadline } from './headline';
import { HERO_EASE, HERO_TONE, type HeroTone, labTone } from './tone';

interface HeroShellProps {
  tone: HeroTone;
  /** Full-bleed ambient ground, rendered behind everything. */
  background: (demo: LabDemo) => ReactNode;
  /** Optional band pinned to the bottom of the viewport (direction C's marquee). */
  band?: (demo: LabDemo) => ReactNode;
  /** Direction C swaps the chips for its marquee, so it opts out here. */
  showChips?: boolean;
  /** Reserve room under the copy for the lab's switch bar. */
  insetBottom?: boolean;
}

/**
 * The centered stack every hero-lab variant shares: same copy, same rhythm,
 * same entry choreography. Only the ground underneath changes, which is the
 * whole point — the six routes have to be comparable like for like.
 */
export function HeroShell({
  tone,
  background,
  band,
  showChips = true,
  insetBottom = false,
}: HeroShellProps) {
  const demo = useLabDemo();
  const reduced = useReducedMotion() ?? false;
  const t = HERO_TONE[tone];
  const lab = labTone(tone);

  /** Heavy fade-up-through-blur, staggered down the stack. */
  const rise = (index: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.85, delay: index * 0.09, ease: HERO_EASE },
        };

  return (
    <section
      className={`relative isolate flex min-h-[100dvh] flex-col overflow-hidden ${t.ground}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {background(demo)}
        {/* Legibility veil. The paintings are the point, but type on top of
            raw brushwork is unreadable — this lifts the middle of the frame
            back toward the ground colour and lets the art live at the edges. */}
        <div className="absolute inset-0" style={{ background: t.veil }} />
      </div>

      <div
        className={`mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pt-24 text-center sm:px-6 ${
          band ? 'pb-44 sm:pb-48' : insetBottom ? 'pb-24' : 'pb-16'
        }`}
      >
        <motion.div {...rise(0)}>
          <HeroHeadline ink={t.ink} />
        </motion.div>

        <motion.p
          {...rise(1)}
          className={`mt-5 max-w-2xl text-pretty text-base leading-[1.6] ${t.body}`}
        >
          {HERO_COPY.subtitle}
        </motion.p>

        <motion.div {...rise(2)} className="mt-8 w-full">
          <CommandBar demo={demo} tone={lab} />
        </motion.div>

        {showChips ? (
          <div className="mt-4 min-h-8 w-full">
            <DemoChips demo={demo} tone={lab} />
          </div>
        ) : null}

        <div className="mt-5 w-full">
          <DerivationCard demo={demo} tone={lab} />
        </div>

        <motion.p {...rise(4)} className={`mt-2 text-xs sm:text-sm ${t.faint}`}>
          {HERO_COPY.beta}
        </motion.p>
      </div>

      {/* Docked to the viewport, not the section: the shelf is the whole point
          of direction C, so it must never fall below the fold. */}
      {band ? (
        <div className="fixed inset-x-0 bottom-0 z-10">{band(demo)}</div>
      ) : null}
    </section>
  );
}
