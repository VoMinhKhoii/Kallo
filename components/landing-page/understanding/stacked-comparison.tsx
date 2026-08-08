import { useTranslations } from 'next-intl';
import { CompareMealCard } from './compare-meal-card';
import type { Comparison } from './comparisons';

/**
 * Height of the title band, and therefore the stack's step.
 *
 * These are the same number on purpose: each card rests exactly one band lower
 * than the one before it, so the sliver every buried card still shows is its
 * own title rather than an anonymous strip of beige. Change one and the other
 * has to move with it.
 */
const TITLE_BAND_REM = 4;

/**
 * Where the first card comes to rest: just clear of the fixed page header.
 *
 * It sat at 15rem while the section heading was sticky above it. The heading
 * scrolls now, so that reserved band was simply empty once it had gone by —
 * which is the emptiness the sticky heading had been added to solve. Sitting
 * the pile high fixes it without pinning anything.
 */
const STACK_TOP_REM = 8;

/**
 * One category in the stack: a heading, a line saying what to look for, and the
 * two meals side by side.
 *
 * The card is opaque on purpose. These stack by sticking at increasing offsets,
 * so each one slides over the last and has to hide it completely except for the
 * sliver of its top edge — a translucent card here would show two sets of
 * numbers through each other, which is the one thing this section cannot do.
 */
export function StackedComparison({
  comparison,
  /** 0-based position in the stack, used for the resting offset and the tab. */
  index,
  /** How many cards the pile holds. Vietnamese has three, English four. */
  total,
}: {
  comparison: Comparison;
  index: number;
  total: number;
}) {
  const t = useTranslations('landing.understanding');
  const [before, after] = comparison.variants;

  // What makes the pile leave as one object instead of peeling apart.
  //
  // A sticky element releases when its CONTAINER's bottom edge reaches the
  // element's own bottom — and that bottom is inset by the element's bottom
  // margin. Every card here is the same height but stuck at a different `top`,
  // so without this the lowest card in the pile had the lowest bottom edge and
  // released first, then the next, then the next: the stack came apart from the
  // front as it left. Which is exactly the "weird" part.
  //
  // Release happens at `top + height + marginBottom`. `top` grows by one band
  // per card, so giving each card a bottom margin that SHRINKS by one band
  // makes that sum identical for every card, and they all let go on the same
  // pixel. The constant is just a gap so the cards are not flush in flow.
  //
  // Only from `md`: below that nothing is sticky and a 12rem margin would be a
  // 12rem hole. The value rides a custom property so the breakpoint can live in
  // a class while the number stays computed.
  const stackMarginRem = 1.5 + (total - 1 - index) * TITLE_BAND_REM;

  return (
    // Each card rests one title band lower than the one before it, so the pile
    // leaves a readable ledge — its heading — for every card underneath.
    //
    // Sticky only from `md`: on a phone the two meals sit one above the other,
    // which makes the card taller than the viewport, and a sticky element
    // taller than its scrollport pins at the wrong end and never releases.
    <div
      className="md:sticky md:mb-[var(--stack-mb)]"
      style={
        {
          top: `${STACK_TOP_REM + index * TITLE_BAND_REM}rem`,
          '--stack-mb': `${stackMarginRem}rem`,
        } as React.CSSProperties
      }
    >
      {/* Four stacked shadows rather than one, so the card reads as a physical
          slab being dealt onto a pile: a hairline contact shadow holding it to
          the page, then three progressively wider and softer casts. All are
          espresso-tinted (20,20,19) rather than black — a neutral-black shadow
          on cream greys the paper under it and is the fastest way to make a
          warm palette look cheap. The inset highlight along the top edge is
          what actually sells the depth: it reads as light catching the lip. */}
      {/* `md:min-h` is load-bearing, not cosmetic. Cards carry between one and
          three dish rows, and a card that lands on the pile much SHORTER than
          the one beneath it leaves the lower card's bottom sticking out below
          it — two sets of numbers visible at once, which is the one thing this
          section cannot do.

          The floor is set just above the natural height of the three-row case.
          It was 26rem, which cleared that case by several rem and put a band of
          dead beige under every card; a card may in fact be up to one title
          band shorter than the one above it and still cover it, so the floor
          only has to stop the one-row cards collapsing. */}
      <div className="overflow-hidden rounded-[2rem] border border-nham-border/60 bg-nham-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(20,20,19,0.05),0_8px_16px_-8px_rgba(20,20,19,0.10),0_24px_48px_-16px_rgba(20,20,19,0.16),0_48px_96px_-32px_rgba(20,20,19,0.20)] md:min-h-[23rem]">
        {/* The title band. Its height is exactly the stack's step, so the strip
            each buried card still shows is precisely this band — you can read
            "Skin on, or skin off" off a card three deep in the pile. Everything
            else about the card lives below it and is allowed to be covered. */}
        <div
          className="flex items-center px-6 sm:px-8 lg:px-10"
          style={{ minHeight: `${TITLE_BAND_REM}rem` }}
        >
          {/* `leading-[1.4]`, not the display-tight 1.15 the other headings
              use. `truncate` sets `overflow: hidden`, and Vietnamese is full of
              descenders — the y of "hay", the g of "sống" — which a serif hangs
              below a 1.15 line box. They were being sliced off mid-stroke. */}
          <h3 className="truncate font-normal font-serif text-2xl text-nham-text leading-[1.4] tracking-[-0.02em] md:text-3xl">
            {t(`categories.${comparison.id}.title`)}
          </h3>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10">
          <p className="max-w-2xl font-sans-display text-base text-nham-text leading-relaxed">
            {t(`categories.${comparison.id}.note`)}
          </p>

          {/* Equal columns up to `lg`, content-width from `lg`.
              `auto-cols-max` lets each card take exactly the width its own
              sentence needs on one line, so the two cards end up different
              widths and their dish rows sit level — which is the point, since
              those rows are what you read across. Below `lg` there is not
              enough width for two one-line sentences, so equal columns plus the
              card's own two-line floor keeps the rows level instead. */}
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:auto-cols-max lg:grid-flow-col lg:grid-cols-none">
            <CompareMealCard comparison={comparison} variant={before} />
            <CompareMealCard comparison={comparison} variant={after} />
          </div>
        </div>
      </div>
    </div>
  );
}
