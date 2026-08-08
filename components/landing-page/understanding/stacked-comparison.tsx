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
const TITLE_BAND_REM = 4.75;

/**
 * Where the first card comes to rest: directly under the pinned section
 * heading, never over it.
 *
 * This is `HEADING_TOP_REM + HEADING_REM` plus a rem of air, both of which live
 * in `understanding-section.tsx`. If the heading changes size, this moves too,
 * or the pile lands on top of the title.
 */
export const STACK_TOP_REM = 15.5;

/**
 * The height of each card's sticky WRAPPER — not of the card you can see.
 *
 * This is what makes the pile leave in one piece. Release happens at
 * `top + height + marginBottom`; the margins cancel out the differing `top`s,
 * but only if `height` is the same for every card. Sizing the visible panel to
 * they naturally want 22.61, 20.89, 24.23 and 20.89rem. So the wrapper is held
 * level and the panel inside keeps its own height with consistent padding.
 *
 * It has to clear the tallest panel — a shorter wrapper would let its card
 * spill into the next one's flow slot during the deal-in — so re-measure it
 * whenever these cards gain content.
 */
export const CARD_REM = 24.5;

/**
 * The scroll position, in rem down the container, at which every card lets go.
 *
 * Exported because the section heading has to join the same group — it is a
 * sticky sibling in the same container, so if its threshold differs it either
 * gets left behind after the pile has gone or leaves before it.
 */
export function stackReleaseRem(total: number) {
  return (
    STACK_TOP_REM + CARD_REM + STACK_GAP_REM + (total - 1) * TITLE_BAND_REM
  );
}

/** Flow gap under the last card, added to every card's margin equally. */
const STACK_GAP_REM = 1.5;

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
  const stackMarginRem = STACK_GAP_REM + (total - 1 - index) * TITLE_BAND_REM;

  return (
    // Each card rests one title band lower than the one before it, so the pile
    // leaves a readable ledge — its heading — for every card underneath.
    //
    // Sticky only from `md`: on a phone the two meals sit one above the other,
    // which makes the card taller than the viewport, and a sticky element
    // taller than its scrollport pins at the wrong end and never releases.
    <div
      className="md:sticky md:mb-[var(--stack-mb)] md:h-[var(--card-h)]"
      style={
        {
          top: `${STACK_TOP_REM + index * TITLE_BAND_REM}rem`,
          '--stack-mb': `${stackMarginRem}rem`,
          '--card-h': `${CARD_REM}rem`,
        } as React.CSSProperties
      }
    >
      {/* Two things here are doing work rather than decoration.

          The shadow is four casts, not one, so the card reads as a physical
          slab dealt onto a pile: a hairline contact shadow holding it to the
          page, then three progressively wider and softer ones. All are
          espresso-tinted rather than black, because a neutral-black shadow on
          cream greys the paper under it. The inset highlight along the top edge
          is what sells the depth — light catching the lip.

          The panel takes its NATURAL height — content plus the same padding on
          every card. It was pinned to one height so all four shared a release
          threshold, but the four want 21.25, 19.5, 22.88 and 19.5rem, so
          holding them level pooled a different amount of empty beige under each
          one and read as inconsistent padding. The fixed height lives on the
          sticky wrapper above instead, which is the box release timing actually
          measures; the panel inside is free.

          That leaves coverage, which the numbers happen to satisfy: a card may
          be up to one title band shorter than the one it lands on and still
          hide it, and the biggest drop between neighbours here is 3.34rem
          against a 4.75rem band. Reorder the comparisons, or give one a fourth
          dish row, and that has to be re-checked. */}
      <div className="overflow-hidden rounded-[2rem] border border-nham-border/60 bg-nham-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(20,20,19,0.05),0_8px_16px_-8px_rgba(20,20,19,0.10),0_24px_48px_-16px_rgba(20,20,19,0.16),0_48px_96px_-32px_rgba(20,20,19,0.20)]">
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

        <div className="px-6 pb-7 sm:px-8 sm:pb-8 lg:px-10">
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
          <div className="mt-4 grid gap-3.5 md:grid-cols-2 2xl:grid-cols-[auto_auto]">
            <CompareMealCard comparison={comparison} variant={before} />
            <CompareMealCard comparison={comparison} variant={after} />
          </div>
        </div>
      </div>
    </div>
  );
}
