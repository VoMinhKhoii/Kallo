'use client';

import { motion, useReducedMotion } from 'motion/react';
import { LAB_COPY } from '../copy';

/**
 * v3's section below the fold: type does all the work — oversized
 * numerals, generous air, hairline rules. Threads-grade restraint.
 */
export function V3Derivation() {
  const prefersReducedMotion = useReducedMotion();
  const { derivation } = LAB_COPY;

  return (
    <section
      id="derivation"
      className="scroll-mt-24 border-[#E8D5B5]/60 border-t bg-[#FEFBF6] px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-4xl">
        <p className="mb-4 font-bold text-[#8B7355] text-[10px] uppercase tracking-[0.2em]">
          {derivation.eyebrow}
        </p>
        <h2 className="mb-20 font-normal font-serif text-4xl text-[#2C2416] leading-[1.15] sm:text-5xl">
          {derivation.title}{' '}
          <span className="font-light text-[#A9834E] italic">
            {derivation.titleHighlight}
          </span>
        </h2>

        <div>
          {derivation.steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.7 }
              }
              className={`grid gap-6 border-[#E8D5B5] border-t py-12 sm:grid-cols-[8rem_1fr] sm:gap-10 lg:py-16 ${
                index % 2 === 1 ? 'sm:pl-16' : ''
              }`}
            >
              <p className="font-light font-serif text-6xl text-[#C9A87C] italic tabular-nums leading-none sm:text-7xl">
                {String(index + 1).padStart(2, '0')}
              </p>
              <div className="max-w-lg">
                <h3 className="mb-3 font-normal font-serif text-2xl text-[#2C2416] sm:text-3xl">
                  {step.title}
                </h3>
                <p className="font-sans-display text-[#6B5D4F] text-base leading-relaxed">
                  {step.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
