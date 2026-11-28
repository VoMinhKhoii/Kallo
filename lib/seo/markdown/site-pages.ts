import type { Locale } from '@/i18n/config';
import { FOOD_PAGES } from '@/lib/seo/food-pages/pages';
import { sitePage } from '@/lib/seo/public-pages';
import {
  renderAlternativeMarkdown,
  renderCompareMarkdown,
} from './compare-pages';
import { renderFoodHubMarkdown, renderFoodPageMarkdown } from './food';
import { renderMealDataMarkdown } from './meal-data';
import { renderPricingMarkdown } from './pricing';
import { renderToolMarkdown, renderToolsHubMarkdown } from './tools';

/**
 * The Markdown for a public page outside the docs (the food pages, the
 * calculators, the comparison and alternatives pages, the data page, pricing),
 * by its locale-relative path. Which paths are pages is `sitePage`'s answer,
 * the same one `negotiate` uses to send a request here.
 */
export async function renderSitePageMarkdown(
  locale: Locale,
  path: string
): Promise<string | null> {
  const page = sitePage(locale, path);
  switch (page?.kind) {
    case 'pricing':
      return renderPricingMarkdown(locale);
    case 'tools-hub':
      return renderToolsHubMarkdown(locale);
    case 'tool':
      return renderToolMarkdown(locale, page.slug);
    case 'food-hub':
      return renderFoodHubMarkdown(page.locale);
    case 'food':
      return renderFoodPageMarkdown(FOOD_PAGES[page.key.slug]);
    case 'meal-data':
      return renderMealDataMarkdown(page.locale);
    case 'compare':
      return renderCompareMarkdown(page.slug);
    case 'alternative':
      return renderAlternativeMarkdown(page.slug);
    default:
      return null;
  }
}
