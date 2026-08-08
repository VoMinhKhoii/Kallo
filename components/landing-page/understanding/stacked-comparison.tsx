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
}: {
  comparison: Comparison;
  index: number;
}) {
  const t = useTranslations('landing.understanding');
  const [before, after] = comparison.variants;

  return (
    // Each card rests 2.5rem lower than the one before it, so the stack leaves
    // a readable ledge of every card underneath rather than one flush edge.
    // The 7rem base clears the fixed header (~5rem) with room to spare — at
    // 5rem the first card sat right on the header's bottom rule.
    //
    // Sticky only from `md`: on a phone the two meals sit one above the other,
    // which makes the card taller than the viewport, and a sticky element
    // taller than its scrollport pins at the wrong end and never releases.
    <div
      className="md:sticky"
      style={{ top: `calc(7rem + ${index * TITLE_BAND_REM}rem)` }}
    >
      {/* Four stacked shadows rather than one, so the card reads as a physical
          slab being dealt onto a pile: a hairline contact shadow holding it to
          the page, then three progressively wider and softer casts. All are
          espresso-tinted (20,20,19) rather than black — a neutral-black shadow
          on cream greys the paper under it and is the fastest way to make a
          warm palette look cheap. The inset highlight along the top edge is
          what actually sells the depth: it reads as light catching the lip. */}
      {/* `md:min-h` is load-bearing, not cosmetic. Cards carry between one and
          three dish rows, and a card that lands on the pile SHORTER than the
          one beneath it leaves the lower card's bottom sticking out below it —
          two sets of numbers visible at once, which is the one thing this
          section cannot do. A floor tall enough for the three-row case makes
          every card cover the one it lands on. */}
      <div className="overflow-hidden rounded-[2rem] border border-nham-border/60 bg-nham-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(20,20,19,0.05),0_8px_16px_-8px_rgba(20,20,19,0.10),0_24px_48px_-16px_rgba(20,20,19,0.16),0_48px_96px_-32px_rgba(20,20,19,0.20)] md:min-h-[26rem]">
        {/* The title band. Its height is exactly the stack's step, so the strip
            each buried card still shows is precisely this band — you can read
            "Skin on, or skin off" off a card three deep in the pile. Everything
            else about the card lives below it and is allowed to be covered. */}
        <div
          className="flex items-center px-6 sm:px-8 lg:px-10"
          style={{ minHeight: `${TITLE_BAND_REM}rem` }}
        >
          <h3 className="truncate font-normal font-serif text-2xl text-nham-text leading-[1.15] tracking-[-0.02em] md:text-3xl">
            {t(`categories.${comparison.id}.title`)}
          </h3>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10">
          <p className="max-w-2xl font-sans-display text-base text-nham-text leading-relaxed">
            {t(`categories.${comparison.id}.note`)}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <CompareMealCard comparison={comparison} variant={before} />
            <CompareMealCard comparison={comparison} variant={after} />
          </div>
        </div>
      </div>
    </div>
  );
}
