'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { AdjustmentCard } from './adjustment-card';

/**
 * The three things a sentence carries and a photograph does not: a
 * substitution, a swap, and a day you forgot to log.
 */
const ADJUSTMENTS = ['oil', 'milk', 'backfill'] as const;

/**
 * Why text-first.
 *
 * Three sentences somebody would actually type, and what each one changes.
 * The examples are the argument; prose explaining them would be the same claim
 * twice. So there is a headline before and two lines after, and nothing else —
 * the hero sets the density for this page and this section has to match it.
 *
 * Reveals on scroll and then stops. The section it replaces pinned 300vh and
 * drove a four-stage animation off scroll position, which was the worst thing
 * on the page on a phone; that does not come back.
 */
export function TextFirstSection() {
  const t = useTranslations('landing.why');
  const reduced = useReducedMotion() ?? false;

  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
      };

  return (
    // Transparent: the cream comes from `body` and the drifting wash sits
    // behind it. Sections are separated by a hairline rather than a colour
    // change, so the white cards keep reading as cards.
    <section
      id="why"
      className="relative scroll-mt-20 border-nham-border/40 border-t py-24 md:py-32"
    >
      {/* Same measure as the hero, so the page has one width. The blocks
          inside keep their own max-widths — a headline and two lines of prose
          set across 1600px would be unreadable however wide the section is. */}
      <div className="mx-auto max-w-[100rem] px-4 text-center sm:px-6">
        <motion.div {...reveal}>
          <h2 className="mx-auto max-w-3xl text-balance font-normal font-serif text-4xl text-nham-text leading-[1.1] tracking-[-0.02em] md:text-5xl">
            {t('title')}{' '}
            <span className="italic-accent">{t('titleAccent')}</span>
          </h2>
        </motion.div>

        <motion.div
          {...reveal}
          className="mt-12 grid gap-4 text-left md:mt-16 md:grid-cols-3"
        >
          {ADJUSTMENTS.map((id) => (
            <AdjustmentCard key={id} id={id} />
          ))}
        </motion.div>

        <motion.div {...reveal} className="mt-12 space-y-2">
          {/* The concession, in the brand's italic. Saying the cost out loud is
              what makes the line under it believable. */}
          <p className="italic-accent font-serif text-nham-text text-xl">
            {t('tradeoff')}
          </p>
          <p className="mx-auto max-w-xl font-sans-display text-nham-text-muted text-sm leading-relaxed">
            {t('sources')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
