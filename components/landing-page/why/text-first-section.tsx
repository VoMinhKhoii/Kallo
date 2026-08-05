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
 * The case is not only that describing a meal is more accurate than
 * photographing it — it is that a sentence fits how people actually eat.
 * Substitutions, preparation, the Tuesday you forgot: none of it survives a
 * camera. The section ends by conceding the cost (typing is more work) rather
 * than pretending there isn't one, and by pointing at relog and barcode, which
 * are what keep the typing down to whatever is new.
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
    // Cream canvas with a hairline rule, not a colour change. The whole page
    // is one sheet of paper; sections are separated the way the design system
    // separates everything else — by a hairline, so the white cards keep
    // reading as cards.
    <section
      id="why"
      className="relative scroll-mt-20 border-nham-border/40 border-t bg-nham-surface py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <motion.div {...reveal}>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h2 className="mt-4 max-w-3xl font-normal font-serif text-4xl text-nham-text leading-[1.1] tracking-[-0.02em] md:text-5xl">
            {t('title')}{' '}
            <span className="italic-accent">{t('titleAccent')}</span>
          </h2>
          <p className="mt-6 max-w-2xl font-sans-display text-lg text-nham-text-soft leading-relaxed">
            {t('lead')}
          </p>
        </motion.div>

        <motion.div
          {...reveal}
          className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3"
        >
          {ADJUSTMENTS.map((id) => (
            <AdjustmentCard key={id} id={id} />
          ))}
        </motion.div>

        <motion.div
          {...reveal}
          className="mt-14 grid gap-10 border-nham-border/50 border-t pt-12 md:mt-16 md:grid-cols-2 md:gap-14"
        >
          <div>
            <h3 className="font-medium font-sans-display text-nham-text">
              {t('sourcesTitle')}
            </h3>
            <p className="mt-3 font-sans-display text-nham-text-soft leading-relaxed">
              {t('sourcesBody')}
            </p>
          </div>

          <div>
            {/* The concession, in the brand's italic. Saying the cost out loud
                is what makes the sentence after it believable. */}
            <p className="font-serif text-2xl text-nham-text leading-snug">
              <span className="italic-accent">{t('tradeoff')}</span>
            </p>
            <p className="mt-3 font-sans-display text-nham-text-soft leading-relaxed">
              {t('tradeoffBody')}
            </p>
            <p className="mt-4 font-sans-display text-nham-text-muted text-sm leading-relaxed">
              {t('fallback')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
