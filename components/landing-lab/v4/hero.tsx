'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { scrollToAnchorId } from '@/components/landing-page/scroll-to-anchor';
import { CommandBar, DemoChips } from '../command-bar';
import { LAB_COPY } from '../copy';
import { DerivationCard } from '../derivation-card';
import { useLabDemo } from '../use-demo';

/** The grain texture the production problem-section uses. */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/**
 * v4: the wildcard. No canvas, no field — an espresso-dark museum
 * catalog where oversized Lora and hairline tan rules do all the work.
 * The command bar reads as a lit vitrine on a dark wall.
 */
export function V4Hero() {
  const demo = useLabDemo();
  // Skip the entrance slide for users who prefer reduced motion.
  const entrance = useReducedMotion() ? false : { opacity: 0, y: 16 };

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#2C2416] px-6 pt-28 pb-16 text-center">
      <Grain />
      {/* One warm pool of light behind the vitrine. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 58%, rgba(201,168,124,0.14), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <motion.div
          initial={entrance}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-10 flex items-center gap-4"
        >
          <span className="h-px w-10 bg-[#C9A87C]/40" />
          <span className="flex items-center gap-2 font-semibold text-[#C9A87C] text-xs uppercase tracking-[0.25em]">
            <Sparkles className="h-3.5 w-3.5" />
            {LAB_COPY.badge}
          </span>
          <span className="h-px w-10 bg-[#C9A87C]/40" />
        </motion.div>

        <h1 className="mb-8 font-normal font-serif text-5xl text-[#FEFBF6] leading-[1.04] tracking-[-0.03em] sm:text-7xl lg:text-[6.5rem]">
          {LAB_COPY.title}
          <br />
          <span className="font-light text-[#C9A87C] italic">
            {LAB_COPY.titleHighlight}
          </span>
        </h1>

        <p className="mx-auto mb-12 max-w-xl font-light font-sans-display text-[#B8A88E] text-lg leading-relaxed">
          {LAB_COPY.subtitle}
        </p>

        <motion.div
          initial={entrance}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="w-full [&>form]:shadow-[0_0_80px_-10px_rgba(201,168,124,0.35)]"
        >
          <CommandBar demo={demo} />
        </motion.div>

        <div className="mt-4 min-h-8">
          <DemoChips demo={demo} tone="dark" />
        </div>

        <div className="mt-6 w-full">
          <DerivationCard demo={demo} tone="dark" />
        </div>

        <motion.div
          initial={entrance}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-2 flex flex-col items-center gap-4 sm:flex-row"
        >
          <button
            type="button"
            className="group flex items-center gap-2 rounded-xl bg-[#C9A87C] px-7 py-3.5 font-medium text-[#2C2416] text-sm tracking-wide transition-transform hover:-translate-y-0.5"
          >
            {LAB_COPY.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            type="button"
            onClick={() => scrollToAnchorId('derivation')}
            className="rounded-xl border border-[#FEFBF6]/20 px-7 py-3.5 font-medium text-[#FEFBF6] text-sm tracking-wide transition-colors hover:border-[#C9A87C]/60 hover:text-[#C9A87C]"
          >
            {LAB_COPY.ctaSecondary}
          </button>
        </motion.div>

        <p className="mt-10 font-medium text-[#B8A88E]/80 text-sm">
          {LAB_COPY.beta}
        </p>
      </div>
    </section>
  );
}
