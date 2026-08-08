'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { COMPARISONS_BY_LOCALE } from './comparisons';
import { StackedComparison } from './stacked-comparison';

/**
 * Where the heading pins, and how tall it is held.
 *
 * The height is fixed rather than natural because `STACK_TOP_REM` is derived
 * from it — these two added together plus a rem of air, so the cards stack
 * UNDER the title instead of over it. Move either and that constant has to move
 * with it.
 *
 * The h2 measures 7.8rem; this clears it with a little slack.
 */
const HEADING_TOP_REM = 6;
const HEADING_REM = 8.5;

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

  // A plain gap, not a computed one.
  //
  // This used to be sized so the heading released on the cards' threshold and
  // the whole section left as one object. The arithmetic worked, but the margin
  // is real flow space: it put roughly 39rem between the heading and the first
  // card, so the heading pinned and then you scrolled most of a screen through
  // nothing before a card arrived. The void was worse than the thing it bought.
  //
  // So the heading now pins, holds while the first cards land under it, and
  // unpins early to scroll away on its own. The pile still leaves as one piece.
  const headingMarginRem = 2;

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
      className="relative scroll-mt-20 border-nham-border/40 border-t py-12 md:py-16"
    >
      <div className="mx-auto max-w-[88rem] px-6 sm:px-12 lg:px-20">
        {/* The hero's headline treatment at the pricing heading's size, in two
            blocks so the rule sits under the second clause rather than wherever
            the text happens to wrap.

            Sticky, and it unpins EARLY — before the pile leaves. That is the
            safe direction. A sticky element releases when its container's bottom
            reaches `top + height + marginBottom`; hold the heading past the
            pile's own release and the departing cards slide up over it and
            shear it in half, because they cannot cover the strip above their
            own top edge. Letting it go first just means it scrolls away
            normally, which is unremarkable. */}
        <motion.div
          {...reveal}
          className="text-center md:sticky md:top-24 md:mb-[var(--heading-mb)] md:h-[var(--heading-h)]"
          style={
            {
              '--heading-h': `${HEADING_REM}rem`,
              '--heading-mb': `${headingMarginRem}rem`,
            } as React.CSSProperties
          }
        >
          <h2 className="font-medium font-serif text-5xl text-nham-text leading-[1.04] tracking-[-0.03em] md:text-6xl">
            <span className="block">{t('titleLead')}</span>
            <span className="block underline decoration-[0.055em] underline-offset-[0.16em]">
              {t('titleUnderlined')}
            </span>
          </h2>
        </motion.div>

        {/* The pile. Sticky children release when their PARENT's bottom reaches
            them, so this container decides when the stack breaks up.

            `md:space-y-0` looks like spacing and is not: from `md` the gaps
            come from each card's own bottom margin, which is doing arithmetic
            (see StackedComparison), and a uniform gap would break it. */}
        <div className="mt-10 space-y-5 md:mt-0 md:space-y-0">
          {comparisons.map((comparison, index) => (
            <StackedComparison
              key={comparison.id}
              comparison={comparison}
              index={index}
              total={comparisons.length}
            />
          ))}
          {/* Scroll runway after the last card is dealt, so the finished pile
              sits complete for a beat before the container's bottom reaches it
              and the whole stack lets go at once. */}
          <div aria-hidden="true" className="hidden md:block md:h-[40vh]" />
        </div>
      </div>
    </section>
  );
}
