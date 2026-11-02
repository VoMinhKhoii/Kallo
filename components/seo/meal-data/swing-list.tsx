import { DocsLink } from '@/components/docs/mdx/prose';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { FOOD_PAGE_PREFIX, type FoodLocale } from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_COPY } from '@/lib/seo/meal-data/copy';
import { formatRatio } from '@/lib/seo/meal-data/facts';
import type { MealSwing } from '@/lib/seo/meal-data/stats';

/** Dishes with their lightest–heaviest span and what each meal was. */
export function SwingList({
  swings,
  locale,
}: {
  swings: MealSwing[];
  locale: FoodLocale;
}) {
  const { formatNumber } = FOOD_PAGE_CHROME[locale];
  const copy = MEAL_DATA_COPY[locale];
  return (
    <ul className="mt-5 divide-y divide-kallo-border/60 border-kallo-border/60 border-y">
      {swings.map((s) => (
        <li className="py-3" key={s.page.slug}>
          <div className="flex items-baseline justify-between gap-4">
            <DocsLink href={`${FOOD_PAGE_PREFIX}/${s.page.slug}`}>
              {s.page.name}
            </DocsLink>
            <span className="shrink-0 text-kallo-text tabular-nums">
              {formatNumber(s.low)}–{formatNumber(s.high)} kcal ·{' '}
              {formatRatio(locale, s.ratio)}×
            </span>
          </div>
          <p className="mt-1 text-kallo-text-muted text-sm">
            {copy.swingLine(s.lowLabel, s.highLabel)}
          </p>
        </li>
      ))}
    </ul>
  );
}
