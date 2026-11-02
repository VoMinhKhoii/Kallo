import { CAPTURES } from './capture-registry';
import { FOODS } from './food-registry';
import { FOOD_PAGE_CHROME } from './page-copy';
import {
  FOOD_PAGE_LOCALES,
  FOOD_SLUGS,
  type FoodLocale,
  type FoodSlug,
} from './slugs';
import {
  FOOD_GROUPS,
  type FoodGroup,
  type FoodPageCapture,
  type FoodPageCopy,
  type FoodPageMeal,
  type FoodPageVariant,
} from './types';

/**
 * The public food pages: "how many calories in X", answered with real meals
 * logged in Kallo rather than one number.
 *
 * Each page is two files: `foods/<group>/<slug>.ts`, written by hand (its meals and
 * the words around them), and `captures/<slug>.json`, written by
 * `scripts/seo/capture-food-page.ts`, which runs each meal through the real
 * pipeline once. Every number comes from the capture. Each locale has its own
 * dishes: a Vietnamese page is its own dish, not a translation.
 */
export interface FoodPage extends FoodPageCopy {
  slug: FoodSlug;
  locale: FoodLocale;
  group: FoodGroup;
  meals: FoodPageMeal[];
  capture: FoodPageCapture;
}

export const FOOD_PAGES = Object.fromEntries(
  FOOD_PAGE_LOCALES.flatMap((locale) =>
    FOOD_SLUGS[locale].map((slug) => {
      const { copy, ...food } = FOODS[slug];
      return [
        slug,
        { slug, locale, ...food, ...copy, capture: CAPTURES[slug] },
      ];
    })
  )
) as Record<FoodSlug, FoodPage>;

/** A locale's pages, in `FOOD_SLUGS` order. */
export function pagesOf(locale: FoodLocale): FoodPage[] {
  return FOOD_SLUGS[locale].map((slug) => FOOD_PAGES[slug]);
}

/** The first and last day a locale's meals were captured (ISO strings). */
export function captureDateRange(locale: FoodLocale): {
  first: string;
  last: string;
} {
  const days = pagesOf(locale)
    .map((page) => page.capture.capturedAt)
    .sort();
  return { first: days[0], last: days.at(-1) as string };
}

/** A meal's total, as its card's rows add up. */
export function mealKcal(variant: FoodPageVariant): number {
  return variant.dishes.reduce((total, dish) => total + dish.calories, 0);
}

/**
 * The span the page's meals cover, rounded out to whole hundreds so a reader
 * can say it aloud: meals of 310 and 975 kcal give "300 to 1,000".
 */
export function kcalSpan(capture: FoodPageCapture, locale: FoodLocale): string {
  const totals = capture.variants.map(mealKcal);
  const lightest = Math.min(...totals);
  // Under 100 kcal, whole hundreds would round a light meal down to "0 to …"
  // (chicken noodle soup's 72 kcal broth meal did); round to tens there.
  const low =
    lightest < 100
      ? Math.floor(lightest / 10) * 10
      : Math.floor(lightest / 100) * 100;
  const high = Math.ceil(Math.max(...totals) / 100) * 100;
  const { formatNumber, spanJoin } = FOOD_PAGE_CHROME[locale];
  return `${formatNumber(low)} ${spanJoin} ${formatNumber(high)}`;
}

/** The breakdown meal's ingredients, largest first. */
export function breakdownOf(page: FoodPage) {
  const variant = page.capture.variants.find((v) => v.key === page.breakdownOf);
  return [...(variant?.ingredients ?? [])].sort((a, b) => b.kcal - a.kcal);
}

/**
 * The food tables the meals actually used, as one phrase in the page's
 * language. The capture script names them in that language.
 */
export function sourcesOf(page: FoodPage): string {
  const sources = new Set(
    page.capture.variants.flatMap((v) => v.ingredients.map((i) => i.source))
  );
  return FOOD_PAGE_CHROME[page.locale].formatList([...sources]);
}

/** A hub's sections: each of its groups with its pages, in `FOOD_SLUGS` order. */
export function pagesByGroup(
  locale: FoodLocale
): { group: FoodGroup; pages: FoodPage[] }[] {
  return (Object.keys(FOOD_GROUPS[locale]) as FoodGroup[]).map((group) => ({
    group,
    pages: pagesOf(locale).filter((page) => page.group === group),
  }));
}

/** The other pages in a page's group, for its "more meals" links. */
export function relatedPages(page: FoodPage): FoodPage[] {
  return pagesOf(page.locale).filter(
    (other) => other.group === page.group && other.slug !== page.slug
  );
}

/** A group's heading on its locale's hub. */
export function groupName(locale: FoodLocale, group: FoodGroup): string {
  return (FOOD_GROUPS[locale] as Record<FoodGroup, string>)[group];
}
