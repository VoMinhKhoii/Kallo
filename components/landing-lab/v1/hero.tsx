'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { scrollToAnchorId } from '@/components/landing-page/scroll-to-anchor';
import { Button } from '@/components/ui/button';
import { CommandBar, DemoChips } from '../command-bar';
import { LAB_COPY } from '../copy';
import { DerivationCard } from '../derivation-card';
import { useLabDemo } from '../use-demo';
import { ShaderField } from './shader-field';

export function V1Hero() {
  const demo = useLabDemo();

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FEFBF6] px-6 pt-28 pb-16 text-center">
      <ShaderField mood={demo.mood} />

      <div className="relative z-10 flex w-full flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#E8D5B5] bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#C9A87C]" />
          <span className="font-semibold text-[#8B7355] text-xs uppercase tracking-[0.2em]">
            {LAB_COPY.badge}
          </span>
        </motion.div>

        {/* The h1 is the LCP element — it must never start at opacity 0. */}
        <h1 className="mb-6 font-normal font-serif text-5xl text-[#2C2416] leading-[1.08] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
          {LAB_COPY.title}
          <br />
          <span className="font-light text-[#A9834E] italic">
            {LAB_COPY.titleHighlight}
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl font-light font-sans-display text-[#6B5D4F] text-lg leading-relaxed">
          {LAB_COPY.subtitle}
        </p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="w-full"
        >
          <CommandBar demo={demo} />
        </motion.div>

        <div className="mt-4 min-h-8">
          <DemoChips demo={demo} />
        </div>

        <div className="mt-6 w-full">
          <DerivationCard demo={demo} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-2 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button variant="hero-dark" size="hero" className="group">
            <span className="font-medium tracking-wide">{LAB_COPY.cta}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            variant="hero-outline"
            size="hero"
            onClick={() => scrollToAnchorId('derivation')}
          >
            {LAB_COPY.ctaSecondary}
          </Button>
        </motion.div>

        <p className="mt-10 font-medium text-[#8B7355] text-sm">
          {LAB_COPY.beta}
        </p>
      </div>
    </section>
  );
}
