'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { COMPARISONS_BY_LOCALE } from './comparisons';
import { StackedComparison } from './stacked-comparison';

/**
 * The proof section: the same meal, one detail added, different numbers.
 *
 * The why-section argues that a sentence carries what a photograph cannot.
 * Nothing on the page showed it. This does, on output captured from the real
 * pipeline — see `comparisons.ts` for the provenance and the two things the
 * copy is not allowed to claim.
 *
 * The categories stack rather than sitting in a column. Each card sticks a
 * little lower than the last, so scrolling deals them onto a pile and the ones
 * already read stay visible as a stack of ledges. That is doing real work here
 * rather than being decoration: the argument is cumulative — it is three
 * different kinds of detail all landing — and a pile you can see growing says
 * that better than three cards that scroll away one at a time.
 *
 * It is CSS `position: sticky` end to end. No scroll listener, no transform
 * driven off scroll position, nothing that can drop frames on a phone. The
 * section this page used to have pinned 300vh and ran a four-stage animation
 * off scroll offset, and it was the worst thing on the page on mobile.
 */
export function UnderstandingSection() {
  const t = useTranslations('landing.understanding');
  const locale = useLocale();
  const reduced = useReducedMotion() ?? false;

  const comparisons = COMPARISONS_BY_LOCALE[locale] ?? COMPARISONS_BY_LOCALE.en;

  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
      };

  return (
    <section
      id="how"
      className="relative scroll-mt-20 border-nham-border/40 border-t py-16 md:py-20"
    >
      <div className="mx-auto max-w-[88rem] px-6 sm:px-12 lg:px-20">
        {/* The hero's headline treatment at the pricing heading's size: same
            serif, same medium weight, same tight leading and tracking, and the
            same underline carrying the part that matters. Two blocks rather
            than one balanced line, so the rule sits under the second clause
            exactly as it does in the hero rather than wherever the text
            happens to wrap. */}
        <motion.div {...reveal} className="text-center">
          <h2 className="font-medium font-serif text-5xl text-nham-text leading-[1.04] tracking-[-0.03em] md:text-6xl">
            <span className="block">{t('titleLead')}</span>
            <span className="block underline decoration-[0.055em] underline-offset-[0.16em]">
              {t('titleUnderlined')}
            </span>
          </h2>
        </motion.div>

        {/* The pile.

            Sticky children release when their PARENT's bottom edge reaches
            them, so the container is what decides when the stack breaks up.
            Without the tail below, the last card arrived at its offset just as
            the container ran out and the whole thing came apart immediately —
            the last card appeared to slide up over everything rather than
            landing on it. The tail buys scroll length after the final card is
            dealt, so the pile sits complete for a beat and then every card
            releases together, keeping its offset, and the stack leaves as one
            object. That is the Wallet behaviour: cards land, pile holds, pile
            goes. */}
        <div className="mt-10 space-y-5 md:mt-12 md:space-y-6">
          {comparisons.map((comparison, index) => (
            <StackedComparison
              key={comparison.id}
              comparison={comparison}
              index={index}
            />
          ))}
          <div aria-hidden="true" className="hidden md:block md:h-[55vh]" />
        </div>
      </div>
    </section>
  );
}
