import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { type HeroMeal, mealTotals } from './logged-meals';
import type { CardInk } from './tone';

/**
 * The expanded body of a logged-meal card: a row per dish, then the totals.
 *
 * Split out for the same reason the product splits it — `meal-details.tsx`
 * sits beside `precise-meal-card.tsx` there, because the card shell and the
 * derivation table change for different reasons and read better apart.
 */
export function LoggedMealDetails({
  meal,
  ink,
}: {
  meal: HeroMeal;
  ink: CardInk;
}) {
  const totals = mealTotals(meal);

  return (
    <div className={`mt-5 border-t pt-4 ${ink.rule}`}>
      <div className="mb-4 space-y-1">
        {meal.items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-2 py-2 font-sans-display text-[13px]"
          >
            <span className={`min-w-0 truncate font-medium ${ink.strong}`}>
              {item.name}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <div
                className={`flex gap-1 text-[9px] tabular-nums ${ink.muted}`}
              >
                <span>P:{formatMacroValue(item.protein)}</span>
                <span>C:{formatMacroValue(item.carbs)}</span>
                <span>F:{formatMacroValue(item.fat)}</span>
              </div>
              <span className={`font-bold tabular-nums ${ink.strong}`}>
                {formatCaloriesValue(item.calories)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`flex items-center justify-between border-t pt-3 ${ink.ruleFaint}`}
      >
        <span
          className={`font-bold font-sans-display text-[13px] ${ink.strong}`}
        >
          Total
        </span>
        <div className="flex items-center gap-4">
          <span
            className={`font-sans-display text-[11px] tabular-nums ${ink.muted}`}
          >
            P: {formatMacroValue(totals.protein)}
            {'  '}C: {formatMacroValue(totals.carbs)}
            {'  '}F: {formatMacroValue(totals.fat)}
          </span>
          <span
            className={`font-bold font-sans-display tabular-nums ${ink.strong}`}
          >
            {formatCaloriesValue(totals.calories)}
          </span>
        </div>
      </div>
    </div>
  );
}
