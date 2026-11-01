import { CAPTURES } from './captures';
import { FOODS } from './foods';
import { FOOD_SLUGS, type FoodSlug } from './slugs';
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
 * Each page is two files: `foods/<slug>.ts`, written by hand (its meals and
 * the words around them), and `captures/<slug>.json`, written by
 * `scripts/seo/capture-food-page.ts`, which runs each meal through the real
 * pipeline once. Every number comes from the capture. English only for now: a
 * Vietnamese page is its own dish list, not a translation.
 */
export interface FoodPage extends FoodPageCopy {
  slug: FoodSlug;
  group: FoodGroup;
  meals: FoodPageMeal[];
  capture: FoodPageCapture;
}

export const FOOD_PAGES = Object.fromEntries(
  FOOD_SLUGS.map((slug) => {
    const { copy, ...food } = FOODS[slug];
    return [slug, { slug, ...food, ...copy, capture: CAPTURES[slug] }];
  })
) as Record<FoodSlug, FoodPage>;

/** A meal's total, as its card's rows add up. */
export function mealKcal(variant: FoodPageVariant): number {
  return variant.dishes.reduce((total, dish) => total + dish.calories, 0);
}

/**
 * The span the page's meals cover, rounded out to whole hundreds so a reader
 * can say it aloud: meals of 310 and 975 kcal give "300 to 1,000".
 */
export function kcalSpan(capture: FoodPageCapture): string {
  const totals = capture.variants.map(mealKcal);
  const low = Math.floor(Math.min(...totals) / 100) * 100;
  const high = Math.ceil(Math.max(...totals) / 100) * 100;
  const kcal = (n: number) => n.toLocaleString('en-US');
  return `${kcal(low)} to ${kcal(high)}`;
}

/** The breakdown meal's ingredients, largest first. */
export function breakdownOf(page: FoodPage) {
  const variant = page.capture.variants.find((v) => v.key === page.breakdownOf);
  return [...(variant?.ingredients ?? [])].sort((a, b) => b.kcal - a.kcal);
}

/** The food tables the meals actually used, as one English phrase. */
export function sourcesOf(capture: FoodPageCapture): string {
  const sources = new Set(
    capture.variants.flatMap((v) => v.ingredients.map((i) => i.source))
  );
  return new Intl.ListFormat('en', { type: 'conjunction' }).format([
    ...sources,
  ]);
}

/** The hub's sections: each group with its pages, in `FOOD_SLUGS` order. */
export function pagesByGroup(): { group: FoodGroup; pages: FoodPage[] }[] {
  return (Object.keys(FOOD_GROUPS) as FoodGroup[]).map((group) => ({
    group,
    pages: FOOD_SLUGS.map((slug) => FOOD_PAGES[slug]).filter(
      (page) => page.group === group
    ),
  }));
}

/** The other pages in a page's group, for its "more meals" links. */
export function relatedPages(page: FoodPage): FoodPage[] {
  return FOOD_SLUGS.map((slug) => FOOD_PAGES[slug]).filter(
    (other) => other.group === page.group && other.slug !== page.slug
  );
}
