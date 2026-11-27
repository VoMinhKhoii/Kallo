import type { Locale } from '@/i18n/config';
import {
  ALTERNATIVE_SLUGS,
  ALTERNATIVES_LOCALE,
  ALTERNATIVES_PREFIX,
  isAlternativeSlug,
} from '@/lib/seo/alternatives/slugs';
import {
  COMPARE_LOCALE,
  COMPARE_PREFIX,
  COMPARE_SLUGS,
  isCompareSlug,
} from '@/lib/seo/compare/slugs';
import { FOOD_PAGES } from '@/lib/seo/food-pages/pages';
import {
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  foodPageKey,
  isFoodLocale,
} from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_PATH } from '@/lib/seo/meal-data/path';
import { PRICING_PATH } from '@/lib/seo/site';
import { isToolSlug, TOOL_SLUGS, TOOLS_PREFIX } from '@/lib/seo/tools/slugs';
import { renderFoodHubMarkdown, renderFoodPageMarkdown } from './food';
import { renderMealDataMarkdown } from './meal-data';
import { renderPricingMarkdown } from './pricing';
import { renderToolMarkdown, renderToolsHubMarkdown } from './tools';
import { renderAlternativeMarkdown, renderCompareMarkdown } from './vendor';

/**
 * The public pages outside the docs that have a Markdown form: the food pages,
 * the calculators, the comparison and alternatives pages, the data page and
 * pricing. A page is named by its locale-relative path, as `negotiate` builds
 * the `/md` rewrite from it (`/calories/pho`).
 *
 * Which URLs negotiate to Markdown is decided in `lib/infra/http/negotiate.ts`
 * from the slug lists alone, so the proxy never loads this copy. The two must
 * agree; the `/md` route's test renders every path `siteMarkdownPaths` lists
 * and checks `negotiate` sends each one here.
 */

/** Every Markdown page in one locale, as locale-relative paths. */
export function siteMarkdownPaths(locale: Locale): string[] {
  const paths = [
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

/** The slug under `prefix`, '' for the prefix itself, or null when not under it. */
function under(path: string, prefix: string): string | null {
  if (path === prefix) return '';
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : null;
}

/** The page's Markdown, or null when the path names no such page. */
export async function renderSitePageMarkdown(
  locale: Locale,
  path: string
): Promise<string | null> {
  if (path === PRICING_PATH) return renderPricingMarkdown(locale);

  const tool = under(path, TOOLS_PREFIX);
  if (tool === '') return renderToolsHubMarkdown(locale);
  if (tool !== null) {
    return isToolSlug(tool) ? renderToolMarkdown(locale, tool) : null;
  }

  if (isFoodLocale(locale)) {
    if (path === MEAL_DATA_PATH) return renderMealDataMarkdown(locale);
    const food = under(path, FOOD_PAGE_PREFIX);
    if (food === '') return renderFoodHubMarkdown(locale);
    const key = food === null ? null : foodPageKey(locale, food);
    if (key) return renderFoodPageMarkdown(FOOD_PAGES[key.slug]);
  }

  const pair = under(path, COMPARE_PREFIX);
  if (pair && locale === COMPARE_LOCALE && isCompareSlug(pair)) {
    return renderCompareMarkdown(pair);
  }
  const app = under(path, ALTERNATIVES_PREFIX);
  if (app && locale === ALTERNATIVES_LOCALE && isAlternativeSlug(app)) {
    return renderAlternativeMarkdown(app);
  }
  return null;
}
