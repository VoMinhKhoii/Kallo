'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { COMPARISONS_BY_LOCALE } from './comparisons';
import { StackedComparison, stackReleaseRem } from './stacked-comparison';

/**
 * Where the heading pins, and how tall it is held.
 *
 * The height is fixed rather than natural because two other things are computed
 * from it: the heading's own release point (see `headingMarginRem`), and where
 * the pile rests — `STACK_TOP_REM` is these two added together plus a rem of
 * air, so the cards stack UNDER the title instead of over it. Move either and
 * that constant has to move with it.
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

  // Put the heading on the cards' release threshold. `top + height + margin`
  // has to match theirs, and the first two are known, so the margin is whatever
  // is left over. It depends on how many cards the locale has, because that is
  // what sets where the pile lets go.
  const headingMarginRem =
    stackReleaseRem(comparisons.length) - HEADING_TOP_REM - HEADING_REM;

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
        {/* Sticky, and in the SAME release group as the cards.

            A sticky element releases when its container's bottom reaches
            `top + height + marginBottom`. The heading is a sibling of the cards
            in this container, so if its threshold differs it either scrolls off
            early or — what happened before — stays pinned long after the pile
            has gone, and the departing cards shear it in half on their way past.

            So it is given a fixed height and a bottom margin that lands its
            threshold exactly on the cards'. Everything in the section then lets
            go on the same pixel and the whole thing leaves as one object. The
            cost is that margin: it is real flow space, so the section is that
            much longer to scroll before the first card arrives. That runway is
            where the heading sits alone, which is the point of pinning it. */}
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
        {/* `space-y` is phone-only. From `md` the gaps come from each card's
            own bottom margin, which is doing arithmetic (see StackedComparison)
            rather than spacing — a uniform `space-y` here would break it. */}
        {/* `md:mt-0` matters: an `mt` here would be an adjacent sibling to the
            heading's computed `mb`, the two would collapse to the larger, and
            the heading's release threshold — which that margin IS — would no
            longer be what the arithmetic thinks it is. */}
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
