import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';

/**
 * The recurring worked example: a meal sentence in, dishes and macros out.
 *
 * This is a deliberate STATIC MIRROR of the confirmed, read-only meal card —
 * `components/logging/feed/meal-entry/meal-entry.tsx` (shell + serif-quoted
 * input) and `components/logging/feed/persisted/meal-details.tsx` (dish rows +
 * totals). Class strings are copied verbatim so the docs and the product stay
 * visually identical; if either of those files changes, change this too.
 *
 * It is a twin rather than a reuse because the real components are
 * `'use client'`, own edit/confirm state, pull the `logging.*` message
 * namespaces, and mount the portion picker — none of which a docs page wants.
 * Numbers are reused through the product's own formatters so units can never
 * drift ("32g", "560 kcal").
 */

export interface MealExampleDish {
  name: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface MealExampleProps {
  /** The sentence the reader would type, diacritics intact. */
  input: string;
  dishes: MealExampleDish[];
  /** Localized word for the totals row — "Tổng" / "Total". */
  totalLabel: string;
}

export function MealExample({ input, dishes, totalLabel }: MealExampleProps) {
  const totals = dishes.reduce(
    (sum, dish) => ({
      protein: sum.protein + dish.protein,
      carbs: sum.carbs + dish.carbs,
      fat: sum.fat + dish.fat,
      calories: sum.calories + dish.calories,
    }),
    { protein: 0, carbs: 0, fat: 0, calories: 0 }
  );

  return (
    <div className="mt-6 rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
      <p className="font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
        &ldquo;{input}&rdquo;
      </p>

      <div className="mt-5 border-nham-border border-t pt-4">
        <div className="mb-4 space-y-1">
          {dishes.map((dish) => (
            <div
              className="flex items-center justify-between py-2 font-sans-display text-[13px]"
              key={dish.name}
            >
              <span className="min-w-0 truncate font-medium text-nham-text">
                {dish.name}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex gap-2 text-[10px] text-nham-text-muted tabular-nums">
                  <span className="text-right">
                    P:{formatMacroValue(dish.protein)}
                  </span>
                  <span className="text-right">
                    C:{formatMacroValue(dish.carbs)}
                  </span>
                  <span className="text-right">
                    F:{formatMacroValue(dish.fat)}
                  </span>
                </div>
                <span className="text-right font-bold text-nham-text tabular-nums">
                  {formatCaloriesValue(dish.calories)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-nham-border/50 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="font-bold font-sans-display text-[13px] text-nham-text">
              {totalLabel}
            </span>
            <div className="flex items-center gap-4">
              <span className="font-sans-display text-[11px] text-nham-text-muted tabular-nums">
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
      </div>
    </div>
  );
}
