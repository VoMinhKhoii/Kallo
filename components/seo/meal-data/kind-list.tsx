import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import type { FoodLocale } from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_COPY } from '@/lib/seo/meal-data/copy';
import type { IngredientStat } from '@/lib/seo/meal-data/stats';

/** Ingredient kinds with how many meals had them and what a serving costs. */
export function KindList({
  kinds,
  locale,
}: {
  kinds: IngredientStat[];
  locale: FoodLocale;
}) {
  const { formatNumber } = FOOD_PAGE_CHROME[locale];
  const copy = MEAL_DATA_COPY[locale];
  return (
    <ul className="mt-5 divide-y divide-kallo-border/60 border-kallo-border/60 border-y">
      {kinds.map((k) => (
        <li
          className="flex flex-wrap items-baseline justify-between gap-x-4 py-3"
          key={k.key}
        >
          <span className="font-sans-display text-kallo-text">
            {copy.kinds[k.key]}
          </span>
          <span className="text-kallo-text-muted text-sm tabular-nums">
            {copy.kindLine(
              k.meals,
              formatNumber(k.medianKcal),
              formatNumber(k.maxKcal)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
