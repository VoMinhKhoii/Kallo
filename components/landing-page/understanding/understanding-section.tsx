'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useClosePileGap } from '@/hooks/landing/use-close-pile-gap';
import { useFadeUnderPinned } from '@/hooks/landing/use-fade-under-pinned';
import { useScrollReveal } from '@/hooks/landing/use-scroll-reveal';
import { landingClip } from '../showcase/media';
import { ProductVideo } from '../showcase/product-video';
import { SectionTitle } from '../showcase/section-title';
import { COMPARISONS_BY_LOCALE } from './comparisons';
import { stackReleaseRem } from './stack-geometry';
import { StackedComparison } from './stacked-comparison';

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
  const introRef = useRef<HTMLDivElement>(null);

  useFadeUnderPinned(introRef, HEADING_TOP_REM + HEADING_REM);
  const sectionRef = useRef<HTMLElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);

  useClosePileGap(sectionRef, pileRef);
  useScrollReveal(sectionRef);

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

  return (
    <section
      ref={sectionRef}
      aria-labelledby="landing-understanding"
      id="how"
      className="relative scroll-mt-20 py-8 md:pt-20 md:pb-10"
    >
      {/* `md:flex-col` is load-bearing: in normal flow the heading's bottom
          margin and the pile's negative top margin are adjacent siblings and
          would COLLAPSE into a single used value, which destroys both the
          cancellation and the sticky arithmetic. Flex children do not collapse
          margins, so the two survive independently. */}
      <div className="mx-auto max-w-[86rem] px-6 sm:px-12 md:flex md:flex-col lg:px-20">
        {/* The hero's headline treatment at the pricing heading's size, in two
            blocks so the rule sits under the second clause rather than wherever
            the text happens to wrap.

            Sticky, and pinned on exactly the same release threshold as the
            cards — see `headingMarginRem` for why that matters and what the
            margin below is doing. */}
        <div
          data-reveal=""
          className="z-10 text-center md:sticky md:top-0 md:mb-[var(--heading-mb)] md:h-[var(--heading-h)] md:pt-24"
          style={
            {
              '--heading-h': `${HEADING_TOP_REM + HEADING_REM}rem`,
              '--heading-mb': `${headingMarginRem}rem`,
              // The scroll reveal (`data-reveal`, globals.css) fades
              // only: no `y` rise, unlike the other sections. This heading is
              // sticky and the first card sits flush under it, so a rise opened
              // and shut the gap between them, and a transform on a sticky
              // element shifts the box its sticky offset is measured against.
              '--reveal-y': '0px',
            } as React.CSSProperties
          }
        >
          <SectionTitle
            id="landing-understanding"
            lead={t('titleLead')}
            rest={t('titleUnderlined')}
          />
        </div>

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
          ref={introRef}
          className="mt-12 text-center md:mt-[var(--intro-mt)] md:[mask-image:linear-gradient(to_bottom,transparent_calc(var(--under-heading,0px)-2rem),black_var(--under-heading,0px))]"
          style={
            { '--intro-mt': `${-headingMarginRem}rem` } as React.CSSProperties
          }
        >
          <div className="overflow-hidden rounded-[1.25rem] bg-kallo-hover sm:rounded-[2rem] md:mt-10">
            <ProductVideo
              clip={landingClip(locale, 'diff')}
              width={2400}
              height={1350}
              label={t('videoLabel')}
              className="aspect-[4/5] object-cover md:aspect-video"
            />
          </div>
        </div>

        <div ref={pileRef} className="mt-10 space-y-5 md:mt-16 md:space-y-0">
          {comparisons.map((comparison, index) => (
            <StackedComparison
              key={comparison.id}
              comparison={comparison}
              index={index}
              total={comparisons.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
