import { Link } from '@/i18n/navigation';
import { type FoodPage, kcalSpan } from '@/lib/seo/food-pages/pages';
import { FOOD_PAGE_PREFIX } from '@/lib/seo/food-pages/slugs';

/**
 * Food pages as a list of links, each with the span its meals cover. Used by
 * the hub and by each page's "More meals". Each link pins its page's locale:
 * a page exists in one locale only, whatever locale links to it.
 */
export function FoodLinkList({ pages }: { pages: FoodPage[] }) {
  return (
    <ul className="mt-5 divide-y divide-kallo-border/60 border-kallo-border/60 border-y">
      {pages.map((page) => (
        <li key={page.slug}>
          <Link
            className="flex items-baseline justify-between gap-4 py-3 font-sans-display text-base text-kallo-text transition-colors hover:text-kallo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
            href={`${FOOD_PAGE_PREFIX}/${page.slug}`}
            locale={page.locale}
          >
            <span>{page.name}</span>
            <span className="shrink-0 text-kallo-text-muted text-sm tabular-nums">
              {kcalSpan(page.capture, page.locale)} kcal
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
