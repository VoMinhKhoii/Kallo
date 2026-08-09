import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { HIGHLIGHT_MARK } from '../highlight';
import type { Comparison, ComparisonVariant, ShiftedItem } from './comparisons';

/** The macro triple, in render order, so the moved one can be picked out. */
const MACROS = [
  { key: 'protein', label: 'P' },
  { key: 'carbs', label: 'C' },
  { key: 'fat', label: 'F' },
] as const;

/**
 * The dish rows: name on the left, the 9px macro triple and bold calories on
 * the right. The hero card's rows, element for element.
 *
 * The mark sits on the dish that moved, not on the total. The total is only the
 * consequence; the dish is where you can see that the words landed on the thing
 * they named — the thigh, the rice, the potatoes — and that nothing else was
 * touched.
 *
 * Marked on BOTH cards, unlike the sentence. Marking a phrase on the left would
 * claim it was the change; marking a number there is the opposite — it is what
 * you read the right one against, and one tinted number with nothing to compare
 * it to is a claim you cannot check.
 */
export function CompareMealRows({
  comparison,
  variant,
  shifted,
  isAfter,
}: {
  comparison: Comparison;
  variant: ComparisonVariant;
  /** The dish whose moved macro gets the marker, or null if nothing moved. */
  shifted: ShiftedItem | null;
  /** Whether this is the right-hand card — the one carrying the added detail. */
  isAfter: boolean;
}) {
  const t = useTranslations('landing.understanding');
  const base = `categories.${comparison.id}`;
  const Arrow = shifted && shifted.delta > 0 ? ArrowUp : ArrowDown;

  return (
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
            {/* Level with the calories from `lg`, a step under them below it.
                The app's own card sets this triple at 9px; here it is the thing
                being compared across a pair rather than a detail skimmed past
                in a feed, so it cannot be the smallest type on the card. But
                two cards share the width from `md`, and at those sizes a triple
                as large as the calories crowds the dish name off its own row —
                so it steps down rather than the row giving way. */}
            <div className="flex items-center gap-1 text-[11px] text-nham-text-soft tabular-nums lg:text-[13px]">
              {MACROS.map(({ key, label }) => {
                const marked =
                  item.id === shifted?.id && comparison.moves === key;
                return (
                  <span
                    key={key}
                    className={
                      marked
                        ? `inline-flex items-center gap-0.5 font-bold ${HIGHLIGHT_MARK}`
                        : undefined
                    }
                  >
                    {label}:{formatMacroValue(item[key])}
                    {/* The arrow lives inside the mark, so the tint and the
                        direction read as one token rather than as a number and
                        a loose glyph beside it.

                        Right card only. It describes the move away from the
                        left one, so on the left there is nothing for it to
                        point away from.

                        Sage and terracotta rather than a true green and red:
                        this palette has no pure hues, and those two are the
                        app's own status pair. Direction only — nothing here
                        claims that up is good, since whether less fat is an
                        improvement depends entirely on who is reading. */}
                    {marked && isAfter && shifted && (
                      <Arrow
                        aria-hidden="true"
                        strokeWidth={3}
                        className={`h-2.5 w-2.5 shrink-0 ${
                          shifted.delta > 0
                            ? 'text-nham-success-dark'
                            : 'text-nham-danger'
                        }`}
                      />
                    )}
                  </span>
                );
              })}
            </div>
            <span className="font-bold text-nham-text tabular-nums">
              {formatCaloriesValue(item.calories)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
