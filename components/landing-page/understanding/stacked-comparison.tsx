import { useTranslations } from 'next-intl';
import { CompareMealCard } from './compare-meal-card';
import { type Comparison, shiftedItem } from './comparisons';
import {
  CARD_REM,
  STACK_GAP_REM,
  STACK_TOP_REM,
  TITLE_BAND_REM,
} from './stack-geometry';

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
  // Resolved once, here, so both cards mark the same dish. See `shiftedItem`.
  const shifted = shiftedItem(comparison);

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
          hide it, and the biggest drop between neighbours here is 4.81rem
          against a 5rem band, with 0.19rem to spare. Reorder the comparisons, or add a
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
          {/* It wraps. It used to `truncate`, which ends a title that does not
              fit with an ellipsis rather than giving it a second line — and
              since the band is a `minHeight`, the room was there for the
              taking. `text-balance` splits the two lines evenly instead of
              leaving one word stranded.

              The cost, accepted: a two-line title makes this band taller than
              TITLE_BAND_REM, so a card buried in the pile shows the first line
              and hides the second. That only bites from `md`, where the pile is
              sticky at all, and at those widths these titles are short enough
              to stay on one line — but a longer title added later has to be
              checked against the band rather than assumed to fit.

              `leading-[1.4]`, not the display-tight 1.15 the other headings
              use: Vietnamese is full of descenders — the y of "hay", the g of
              "sống" — which a serif hangs below a 1.15 line box, and they were
              being sliced off mid-stroke by the old overflow. */}
          <h3 className="text-balance font-normal font-serif text-2xl text-nham-text leading-[1.4] tracking-[-0.02em] md:text-3xl">
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
          <div className="mt-4 grid gap-3.5 md:grid-cols-2 md:grid-rows-[auto_1fr_auto] 2xl:auto-cols-max 2xl:grid-flow-col 2xl:grid-cols-none 2xl:justify-start">
            <CompareMealCard
              comparison={comparison}
              variant={before}
              shifted={shifted}
              isAfter={false}
            />
            <CompareMealCard
              comparison={comparison}
              variant={after}
              shifted={shifted}
              isAfter
            />
          </div>
        </div>
      </div>
    </div>
  );
}
