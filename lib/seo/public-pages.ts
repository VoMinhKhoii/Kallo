import {
  ALTERNATIVE_SLUGS,
  ALTERNATIVES_LOCALE,
  ALTERNATIVES_PREFIX,
  type AlternativeSlug,
  isAlternativeSlug,
} from '@/lib/seo/alternatives/slugs';
import {
  COMPARE_LOCALE,
  COMPARE_PREFIX,
  COMPARE_SLUGS,
  type CompareSlug,
  isCompareSlug,
} from '@/lib/seo/compare/slugs';
import {
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  type FoodLocale,
  type FoodPageKey,
  foodPageKey,
  isFoodLocale,
} from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { PRICING_PATH } from '@/lib/seo/site';
import {
  isToolSlug,
  TOOL_SLUGS,
  TOOLS_PREFIX,
  type ToolSlug,
} from '@/lib/seo/tools/slugs';

/**
 * The public pages outside the docs, by locale-relative path: which page a
 * path names, and every path a locale has. Slug lists only, so the proxy
 * (`negotiate`) can ask without loading any page's copy, and the Markdown
 * renderers (`lib/seo/markdown/site-pages.ts`) dispatch on the same answer.
 *
 * Food pages and the data page exist per food locale; the comparison and
 * alternatives pages in English only; the calculators and pricing everywhere.
 */
export type SitePage =
  | { kind: 'pricing' }
  | { kind: 'tools-hub' }
  | { kind: 'tool'; slug: ToolSlug }
  | { kind: 'food-hub'; locale: FoodLocale }
  | { kind: 'food'; key: FoodPageKey }
  | { kind: 'meal-data'; locale: FoodLocale }
  | { kind: 'compare'; slug: CompareSlug }
  | { kind: 'alternative'; slug: AlternativeSlug };

/** The slug after `prefix/`, or null when `path` is not under it. */
function childOf(path: string, prefix: string): string | null {
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : null;
}

/** The page `path` (e.g. `/calories/pho`) names in `locale`, or null. */
export function sitePage(locale: string, path: string): SitePage | null {
  if (path === PRICING_PATH) return { kind: 'pricing' };
  if (path === TOOLS_PREFIX) return { kind: 'tools-hub' };
  const tool = childOf(path, TOOLS_PREFIX);
  if (tool !== null)
    return isToolSlug(tool) ? { kind: 'tool', slug: tool } : null;

  if (isFoodLocale(locale)) {
    if (path === FOOD_PAGE_PREFIX) return { kind: 'food-hub', locale };
    if (path === MEAL_DATA_PATH) return { kind: 'meal-data', locale };
    const food = childOf(path, FOOD_PAGE_PREFIX);
    const key = food === null ? null : foodPageKey(locale, food);
    if (key) return { kind: 'food', key };
  }

  const pair = childOf(path, COMPARE_PREFIX);
  if (pair !== null && locale === COMPARE_LOCALE && isCompareSlug(pair)) {
    return { kind: 'compare', slug: pair };
  }
  const app = childOf(path, ALTERNATIVES_PREFIX);
  if (
    app !== null &&
    locale === ALTERNATIVES_LOCALE &&
    isAlternativeSlug(app)
  ) {
    return { kind: 'alternative', slug: app };
  }
  return null;
}

/** Every public page outside the docs in one locale, as locale-relative paths. */
export function sitePagePaths(locale: string): string[] {
  const paths: string[] = [
    PRICING_PATH,
    TOOLS_PREFIX,
    ...TOOL_SLUGS.map((tool) => `${TOOLS_PREFIX}/${tool}`),
  ];
  if (isFoodLocale(locale)) {
    paths.push(
      FOOD_PAGE_PREFIX,
      ...FOOD_SLUGS[locale].map((food) => `${FOOD_PAGE_PREFIX}/${food}`),
      MEAL_DATA_PATH
    );
  }
  if (locale === COMPARE_LOCALE) {
    paths.push(...COMPARE_SLUGS.map((pair) => `${COMPARE_PREFIX}/${pair}`));
  }
  if (locale === ALTERNATIVES_LOCALE) {
    paths.push(
      ...ALTERNATIVE_SLUGS.map((app) => `${ALTERNATIVES_PREFIX}/${app}`)
    );
  }
  return paths;
}
