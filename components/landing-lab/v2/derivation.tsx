'use client';

import { motion, useReducedMotion } from 'motion/react';
import { LAB_COPY } from '../copy';
import { getLabFixture } from '../fixtures';

/**
 * v2's section below the fold: the four steps beside a receipt card
 * floating in shallow 3D — a CSS echo of the hero's depth.
 */
export function V2Derivation() {
  const prefersReducedMotion = useReducedMotion();
  const { derivation } = LAB_COPY;
  const fixture = getLabFixture('phoBo');

  return (
    <section
      id="derivation"
      className="scroll-mt-24 overflow-hidden border-[#E8D5B5]/60 border-t bg-[#FAF9F7] px-6 py-24 lg:py-32"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="mb-4 font-bold text-[#8B7355] text-[10px] uppercase tracking-[0.2em]">
            {derivation.eyebrow}
          </p>
          <h2 className="mb-12 font-normal font-serif text-4xl text-[#2C2416] leading-[1.15] sm:text-5xl">
            {derivation.title}{' '}
            <span className="font-light text-[#A9834E] italic">
              {derivation.titleHighlight}
            </span>
          </h2>

          <div className="space-y-8">
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
                className="flex gap-5"
              >
                <p className="w-10 shrink-0 font-light font-serif text-2xl text-[#C9A87C] italic tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <div>
                  <h3 className="mb-1.5 font-normal font-serif text-[#2C2416] text-xl">
                    {step.title}
                  </h3>
                  <p className="font-sans-display text-[#6B5D4F] text-sm leading-relaxed">
                    {step.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* The receipt, floating at a slight tilt. */}
        <div
          style={{ perspective: '1200px' }}
          className="mx-auto w-full max-w-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8 }}
            style={{ transform: 'rotateX(4deg) rotateY(-7deg)' }}
          >
            <motion.div
              animate={{ y: [0, -6, 6, 0] }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 7, repeat: Infinity, ease: 'easeInOut' }
              }
              className="rounded-lg border-[#2C2416] border-t-4 bg-white shadow-[0_40px_80px_-30px_rgba(44,36,22,0.35)]"
            >
              <div className="border-[#E8D5B5] border-b-2 border-dashed p-5 text-center">
                <p className="font-bold text-[#8B7355] text-[10px] uppercase tracking-[0.2em]">
                  Derivation receipt
                </p>
              </div>
              <div className="space-y-4 p-6">
                <p className="font-serif text-[#2C2416] text-lg leading-relaxed">
                  &ldquo;{fixture.text}&rdquo;
                </p>
                <div className="space-y-2 border-[#F0EAE0] border-t pt-4">
                  {fixture.rows.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-[#6B5D4F]">{row.name}</span>
                      <span className="font-mono font-semibold text-[#2C2416] tabular-nums">
                        {row.cal}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline justify-between border-[#F0EAE0] border-t pt-3">
                  <span className="font-serif text-[#2C2416] text-sm">
                    {LAB_COPY.demo.total}
                  </span>
                  <span className="font-mono font-semibold text-[#A9834E] text-lg tabular-nums">
                    {fixture.totalRange}
                    <span className="ml-1 text-[#8B7355] text-xs">kcal</span>
                  </span>
                </div>
                <p className="font-light font-serif text-[#8B7355] text-sm italic">
                  Counted conservatively — honest bounds, not fake precision.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
