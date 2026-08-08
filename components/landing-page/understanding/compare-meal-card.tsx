import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import {
  type Comparison,
  type ComparisonVariant,
  variantTotals,
} from './comparisons';

/**
 * One side of a comparison, in the app's own card language.
 *
 * The body is the hero's card body element for element — the same serif input
 * line, the same 13px dish rows with their 9px macro triple and bold calories,
 * the same Total footer. Two of these sit side by side and the eye has to find
 * one difference between them, so everything else the hero card carries (time
 * divider, entry chip, painting, chevron) is left off: here it would be noise.
 *
 * The words the user added are bold, and they are the only bold in the
 * sentence. That is the section's whole argument rendered as typography — the
 * two sentences are nearly identical, and the part that is not is what moved
 * every number underneath.
 */
export function CompareMealCard({
  comparison,
  variant,
}: {
  comparison: Comparison;
  variant: ComparisonVariant;
}) {
  const t = useTranslations('landing.understanding');
  const tHero = useTranslations('landing.hero');
  const totals = variantTotals(variant);
  const base = `categories.${comparison.id}`;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-nham-border/60 bg-white p-3.5 shadow-sm">
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
      <p className="min-h-[2.75em] font-serif text-[15px] text-nham-text leading-snug first-letter:uppercase 2xl:min-h-0 2xl:whitespace-nowrap">
        {t.rich(`${base}.variants.${variant.id}.input`, {
          // Bold AND underlined, echoing the headline's rule. Only the right
          // card carries any of this: the left is the plain sentence people
          // type, and marking a phrase there would imply it was the change.
          b: (chunks) => (
            <strong className="font-semibold underline decoration-[0.06em] underline-offset-[0.18em]">
              {chunks}
            </strong>
          ),
        })}
      </p>

      <div className="mt-2.5 flex-1 border-nham-border border-t pt-1.5">
        {variant.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 py-1 font-sans-display text-[13px]"
          >
            <span className="min-w-0 truncate font-medium text-nham-text">
              {t(`${base}.items.${item.id}`)}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex gap-1 text-[9px] text-nham-text-soft tabular-nums">
                <span>P:{formatMacroValue(item.protein)}</span>
                <span>C:{formatMacroValue(item.carbs)}</span>
                <span>F:{formatMacroValue(item.fat)}</span>
              </div>
              <span className="font-bold text-nham-text tabular-nums">
                {formatCaloriesValue(item.calories)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex items-center justify-between border-nham-border/50 border-t pt-2">
        <span className="font-bold font-sans-display text-[13px] text-nham-text">
          {tHero('total')}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-sans-display text-[11px] text-nham-text-soft tabular-nums">
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
