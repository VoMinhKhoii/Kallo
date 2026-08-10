import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { HIGHLIGHT_MARK } from '../highlight';
import { CompareMealRows } from './compare-meal-rows';
import {
  type Comparison,
  type ComparisonVariant,
  type ShiftedItem,
  variantTotals,
} from './comparisons';

/**
 * How far the painting comes up — below the hero's 0.65, but not by as much as
 * it first was.
 *
 * The hero card is one large panel with two or three roomy rows; this one is
 * half the height and only one of the pair wears art at all, so the painting is
 * here as warmth in the paper rather than as a picture. It started at 0.22 and
 * read as a smudge — the food was not identifiable, which wastes the one thing
 * the painting is for. The ceiling is set by the dish rows: much past this and
 * the brushwork starts competing with the numbers, which are the argument.
 */
const ART_OPACITY = 0.34;

/**
 * One side of a comparison, in the app's own card language.
 *
 * The body is the hero's card body element for element — the same serif input
 * line, the same 13px dish rows with their 9px macro triple and bold calories,
 * the same Total footer, and the hero's painting on the right card. Two of
 * these sit side by side and the eye has to find one difference between them,
 * so what the hero card carries beyond that (time divider, entry chip,
 * chevron) is left off: here it would be noise.
 *
 * Two marks, both in the same tint, and nothing else on the card is coloured:
 * the words the user added, and the macro they were supposed to move. That is
 * the section's whole argument rendered as typography — the two sentences are
 * nearly identical, and the part that is not is what moved the number.
 */
export function CompareMealCard({
  comparison,
  variant,
  shifted,
  isAfter,
}: {
  comparison: Comparison;
  variant: ComparisonVariant;
  /**
   * The dish whose moved macro gets the marker, and which way it moved.
   *
   * Passed in rather than derived here so both cards are guaranteed to mark the
   * same row — a card that only sees its own variant cannot know what shifted.
   */
  shifted: ShiftedItem | null;
  /**
   * Whether this is the right-hand card — the one carrying the added detail.
   *
   * Drives the two things only that side gets: the painting, and the direction
   * arrow. On both cards the art was the loudest thing in the pair and the eye
   * read two pictures before it read either sentence; on the right one alone it
   * marks the side that changed, and the left stays the plain sheet of paper
   * somebody typed on.
   */
  isAfter: boolean;
}) {
  const t = useTranslations('landing.understanding');
  const tHero = useTranslations('landing.hero');
  const totals = variantTotals(variant);
  const base = `categories.${comparison.id}`;

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-nham-border/60 bg-white p-3.5 shadow-sm md:row-span-3 md:grid md:grid-rows-subgrid">
      {/* `fill` makes this absolutely positioned, so it is out of flow and
          never becomes a grid item. That matters: the card is a 3-row subgrid
          from `md`, and an in-flow child here would take the sentence's row and
          push every row down by one. */}
      {isAfter && (
        <Image
          src={comparison.art}
          alt=""
          fill
          sizes="(min-width: 1536px) 40rem, (min-width: 768px) 45vw, 90vw"
          style={{ opacity: ART_OPACITY }}
          className="-z-10 object-cover"
        />
      )}

      {/* The sentence somebody actually typed. `first-letter:uppercase` rather
          than capitalised copy, because half these sentences open with a digit
          and "1 chén cơm" has no first letter to raise.

          One line from `2xl`, which is what holds the two cards' dish rows level
          with each other — a sentence that wraps drops everything under it by a
          line and the numbers stop being readable across.

          Both the size and the breakpoint are dictated by whether one line can
          actually FIT, and the ceiling is tighter than it looks. The panel is
          capped at 1088px of inner width by the section's measure, so that is
          all there will ever be however wide the screen gets. Measured: the
          raw-weight pair needs 1206px at 17px and about 1064px at 15px. So 17px
          on one line is impossible at ANY viewport, and 15px only clears it
          from `2xl`. It was set to `lg`, where the pair overflowed the panel by
          ~250px and the right-hand card was silently clipped — the panel is
          `overflow-hidden` for its corners.

          Below `2xl` the sentence wraps and carries a two-line floor instead:
          the rows underneath still start at the same height whether the
          sentence took one line or two, which is the actual goal. */}
      <p className="font-serif text-[15px] text-nham-text leading-snug first-letter:uppercase sm:text-[17px] 2xl:whitespace-nowrap">
        {t.rich(`${base}.variants.${variant.id}.input`, {
          // Bold and highlighted, in the same tint the moved macro wears below,
          // so the eye can travel from the words to the number they moved.
          //
          // The underline these used to carry is gone: bold plus underline plus
          // a tinted ground is three marks on one phrase, and the tint alone
          // already outranks the other two.
          //
          // Only the right card carries any of this. The left is the plain
          // sentence people type, and marking a phrase there would imply it was
          // the change.
          b: (chunks) => (
            <strong className={`font-semibold ${HIGHLIGHT_MARK}`}>
              {chunks}
            </strong>
          ),
        })}
      </p>

      <CompareMealRows
        comparison={comparison}
        variant={variant}
        shifted={shifted}
        isAfter={isAfter}
      />

      <div className="mt-1.5 flex items-center justify-between border-nham-border/50 border-t pt-2">
        <span className="font-bold font-sans-display text-[13px] text-nham-text">
          {tHero('total')}
        </span>
        <div className="flex items-center gap-3">
          {/* The total carries no mark. It is the consequence of the shift
              above, not the shift itself, and two highlights per card turned
              the pair into a page of yellow. */}
          {/* No explicit size, so this lands on exactly whatever the calories
              beside it inherit. The app's cards set macros a step or two below
              their calories; the landing page does not, because here the two
              are being read across a pair rather than skimmed down a feed, and
              a macro you have to lean in for cannot be compared at a glance. */}
          <span className="font-sans-display text-nham-text-soft text-sm tabular-nums lg:text-base">
            P: {formatMacroValue(totals.protein)}
            {'  '}C: {formatMacroValue(totals.carbs)}
            {'  '}F: {formatMacroValue(totals.fat)}
          </span>
          <span className="font-bold font-sans-display text-nham-text tabular-nums">
            {formatCaloriesValue(totals.calories)}
          </span>
        </div>
      </div>
    </div>
  );
}
