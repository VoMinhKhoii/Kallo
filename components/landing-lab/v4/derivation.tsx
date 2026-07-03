'use client';

import { motion, useReducedMotion } from 'motion/react';
import { LAB_COPY } from '../copy';
import { Grain } from './hero';

/**
 * v4's section below the fold: the catalog. Four numbered plates in a
 * hairline grid on the same espresso wall.
 */
export function V4Derivation() {
  const prefersReducedMotion = useReducedMotion();
  const { derivation } = LAB_COPY;

  return (
    <section
      id="derivation"
      className="relative scroll-mt-24 border-[#C9A87C]/20 border-t bg-[#261F13] px-6 py-24 lg:py-32"
    >
      <Grain />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-16 flex items-end justify-between gap-8">
          <div>
            <p className="mb-4 font-bold text-[#C9A87C] text-[10px] uppercase tracking-[0.25em]">
              {derivation.eyebrow}
            </p>
            <h2 className="font-normal font-serif text-4xl text-[#FEFBF6] leading-[1.15] sm:text-5xl">
              {derivation.title}{' '}
              <span className="font-light text-[#C9A87C] italic">
                {derivation.titleHighlight}
              </span>
            </h2>
          </div>
        </div>

        <div className="grid border-[#FEFBF6]/10 border-t border-l sm:grid-cols-2">
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
              className="border-[#FEFBF6]/10 border-r border-b p-8 lg:p-12"
            >
              <p className="mb-6 font-medium text-[#C9A87C]/70 text-[10px] uppercase tracking-[0.25em]">
                Plate {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mb-4 font-normal font-serif text-2xl text-[#FEFBF6]">
                {step.title}
              </h3>
              <p className="max-w-sm font-sans-display text-[#B8A88E] text-sm leading-relaxed">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
