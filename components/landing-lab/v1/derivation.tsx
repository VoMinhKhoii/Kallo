'use client';

import { motion, useReducedMotion } from 'motion/react';
import { LAB_COPY } from '../copy';

/**
 * v1's section below the fold: the four derivation steps on quiet paper.
 * Deliberately still — the shader above is the only showpiece.
 */
export function V1Derivation() {
  const prefersReducedMotion = useReducedMotion();
  const { derivation } = LAB_COPY;

  return (
    <section
      id="derivation"
      className="scroll-mt-24 border-[#E8D5B5]/60 border-t bg-[#FAF9F7] px-6 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center lg:mb-20">
          <p className="mb-4 font-bold text-[#8B7355] text-[10px] uppercase tracking-[0.2em]">
            {derivation.eyebrow}
          </p>
          <h2 className="font-normal font-serif text-4xl text-[#2C2416] leading-[1.15] sm:text-5xl">
            {derivation.title}
            <br />
            <span className="font-light text-[#A9834E] italic">
              {derivation.titleHighlight}
            </span>
          </h2>
        </div>

        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {derivation.steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.7, delay: index * 0.08 }
              }
              className="border-[#E8D5B5] border-t pt-6"
            >
              <p className="mb-4 font-light font-serif text-4xl text-[#C9A87C] italic tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mb-3 font-normal font-serif text-[#2C2416] text-xl">
                {step.title}
              </h3>
              <p className="font-sans-display text-[#6B5D4F] text-sm leading-relaxed">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
