'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { COMPARISONS_BY_LOCALE } from './comparisons';
import { StackedComparison, stackReleaseRem } from './stacked-comparison';

/**
 * Where the heading pins, and the height it is held at.
 *
 * `HEADING_TOP_REM + HEADING_REM` must equal `STACK_TOP_REM` EXACTLY, and that
 * is not a tidiness rule — it is what makes the transition smooth.
 *
 * In flow the first card sits flush against the bottom of this box, because the
 * heading's margin and the pile's cancel to zero. Once both are pinned the card
 * sits at `STACK_TOP_REM`. If those two numbers differ, the gap between title
 * and card changes as they stick, and they stick at different moments — the
 * card reaches its offset first and hangs there while the heading is still
 * moving. It was 8.5 against a 15.5 stack top, so the gap jumped a rem mid
 * scroll and read as a stutter.
 *
 * The h2 measures 7.8rem, so the remainder here is the air under the title.
 * Grow that air by growing this, never by pushing the stack top down.
 */
const HEADING_TOP_REM = 6;
const HEADING_REM = 9.5;

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

  // The margin that puts the heading on the cards' release threshold.
  //
  // Sticky elements release when their container's bottom reaches
  // `top + height + marginBottom`. That bottom RISES as you scroll, so a larger
  // threshold fires sooner — and the heading, being two lines tall, has a much
  // smaller threshold than the pile unless it is given one. Left alone it
  // outlasts the cards, and the departing pile shears it in half on the way up.
  //
  // The catch is that this margin is ~41rem of real flow space, which is what
  // put a screen of nothing between the title and the first card. So the pile
  // below cancels it with an equal negative top margin: the margin still exists
  // for the sticky calculation, but occupies no visible space.
  const headingMarginRem =
    stackReleaseRem(comparisons.length) - HEADING_TOP_REM - HEADING_REM;

  // Opacity only — no `y` rise, unlike the other sections.
  //
  // This heading is sticky, and the first card sits flush under it. A 24px rise
  // moves the heading but not the card, so the gap between them opened and shut
  // as the animation played, which read as the whole section stuttering on
  // arrival. Animating a transform on a sticky element is a bad idea besides:
  // it shifts the box the sticky offset is measured against.
  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
      };

  return (
    <section
      id="how"
      className="relative scroll-mt-20 border-nham-border/40 border-t py-12 md:py-16"
    >
      {/* `md:flex-col` is load-bearing: in normal flow the heading's bottom
          margin and the pile's negative top margin are adjacent siblings and
          would COLLAPSE into a single used value, which destroys both the
          cancellation and the sticky arithmetic. Flex children do not collapse
          margins, so the two survive independently. */}
      <div className="mx-auto max-w-[88rem] px-6 sm:px-12 md:flex md:flex-col lg:px-20">
        {/* The hero's headline treatment at the pricing heading's size, in two
            blocks so the rule sits under the second clause rather than wherever
            the text happens to wrap.

            Sticky, and pinned on exactly the same release threshold as the
            cards — see `headingMarginRem` for why that matters and what the
            margin below is doing. */}
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

            The negative top margin is the other half of the heading's oversized
            bottom margin: together they sum to zero, so the first card sits
            directly under the title while the heading still carries the margin
            its release threshold needs.

            `md:space-y-0` looks like spacing and is not: from `md` the gaps
            come from each card's own bottom margin, which is doing arithmetic
            (see StackedComparison), and a uniform gap would break it. */}
        <div
          className="mt-10 space-y-5 md:mt-[var(--pile-mt)] md:space-y-0"
          style={
            { '--pile-mt': `${-headingMarginRem}rem` } as React.CSSProperties
          }
        >
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
