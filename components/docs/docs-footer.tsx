import { getLocale, getTranslations } from 'next-intl/server';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { DocsFooterColumn } from '@/components/docs/docs-footer-column';
import { Link } from '@/i18n/navigation';
import type { DocsNavSection } from '@/lib/domain/docs/tree';
import { FOODS } from '@/lib/seo/food-pages/food-registry';
import { FOOTER_MEALS } from '@/lib/seo/food-pages/footer-meals';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { FOOD_PAGE_PREFIX, isFoodLocale } from '@/lib/seo/food-pages/slugs';
import { LINKEDIN_URL } from '@/lib/seo/structured-data';
import { TOOL_COPY } from '@/lib/seo/tools/content';
import { TOOL_SLUGS, TOOLS_PREFIX } from '@/lib/seo/tools/slugs';

/**
 * The docs navigation, as a footer.
 *
 * This replaced a sticky left sidebar. On a documentation site the full tree is
 * reference material you consult between reads, not a rail you need in view at
 * all times — and moving it out of the viewport gives the reading column the
 * page back. The header keeps ⌘K search for jumping without scrolling.
 *
 * Inverted: espresso ink ground, cream headings, stone links. The colour flip
 * is what ends the document — it needs no top border and no extra spacing to
 * read as "past the content", which a same-surface footer would.
 *
 * `kallo-stone` is the muted ink for this ground specifically. `kallo-text-muted`
 * is tuned to sit on cream and would nearly vanish here.
 *
 * One column below `sm`, left-aligned: a phone reading two narrow columns of
 * page titles wraps most of them, and the wrapping is what makes a directory
 * hard to scan.
 */
interface DocsFooterProps {
  sections: DocsNavSection[];
  /**
   * Wear the landing page's frame instead of the docs one.
   *
   * Two differences, both about sitting correctly under the page above.
   *
   * No gap: docs end on cream, and that gap is what stops the ink slab reading
   * as part of the article. The landing page ends on the beige pricing band, so
   * there the same gap is a strip of page background wedged between two solid
   * colours — a seam rather than breathing room.
   *
   * And the landing measure: the default `90rem / px-4 / sm:px-6` is matched to
   * `app/[locale]/docs/layout.tsx`, so the footer's columns line up with the
   * article above them. The landing page frames everything at `88rem` with far
   * wider side padding, and against that the default makes the footer look like
   * it belongs to a different page.
   */
  landing?: boolean;
}

export async function DocsFooter({
  sections,
  landing = false,
}: DocsFooterProps) {
  const t = await getTranslations('docs');
  const tSections = await getTranslations('docs.sections');
  const tFooter = await getTranslations('landing.footer');
  const locale = await getLocale();

  return (
    <footer
      className={`bg-kallo-ink dark:border-kallo-border dark:border-t dark:bg-card ${landing ? '' : 'mt-24'}`}
    >
      <div
        className={
          landing
            ? 'mx-auto max-w-[92rem] px-6 py-12 sm:px-12 lg:px-20'
            : 'mx-auto max-w-[90rem] px-4 py-16 sm:px-6'
        }
      >
        <nav
          aria-label={t('menu.label')}
          className="grid grid-cols-1 gap-x-8 gap-y-12 text-left sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {sections.map((section) => (
            <DocsFooterColumn
              id={section.id}
              key={section.id}
              label={tSections(section.id)}
              links={section.links.map((link) => ({
                href: `/docs/${link.slug}`,
                title: link.title,
              }))}
            />
          ))}
          {isFoodLocale(locale) ? (
            <>
              <DocsFooterColumn
                id="meals"
                label={FOOD_PAGE_CHROME[locale].footerLink}
                links={FOOTER_MEALS[locale].map((slug) => ({
                  href: `${FOOD_PAGE_PREFIX}/${slug}`,
                  title: FOODS[slug].copy.name,
                }))}
              />
              <DocsFooterColumn
                id="tools"
                label={tFooter('calculators')}
                links={TOOL_SLUGS.map((slug) => ({
                  href: `${TOOLS_PREFIX}/${slug}`,
                  title: TOOL_COPY[locale][slug].name,
                }))}
              />
            </>
          ) : null}
        </nav>

        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-4 border-kallo-stone/25 border-t pt-8">
          <Link
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
            href="/"
          >
            <KalloWordmark className="h-4 w-auto text-kallo-surface dark:text-kallo-text" />
          </Link>
          <p className="text-caption text-kallo-stone">
            {tFooter('copyright', { year: '2026' })}
          </p>
          {/* The one crawlable link to /pricing: the header's "Pricing" is an
              in-page scroll on the landing page, so without this the sitemap
              listed a page nothing on the site pointed at. */}
          <Link
            className="rounded-sm text-caption text-kallo-stone transition-colors hover:text-kallo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent sm:ml-auto dark:hover:text-kallo-text"
            href="/pricing"
          >
            {tFooter('pricing')}
          </Link>
          {/* The calculators' way into the site, in every locale. */}
          <Link
            className="rounded-sm text-caption text-kallo-stone transition-colors hover:text-kallo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent dark:hover:text-kallo-text"
            href={TOOLS_PREFIX}
          >
            {tFooter('calculators')}
          </Link>
          {/* The food pages' way into the site: each locale's footer links
              its own hub, on locales that have one. */}
          {isFoodLocale(locale) ? (
            <Link
              className="rounded-sm text-caption text-kallo-stone transition-colors hover:text-kallo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent dark:hover:text-kallo-text"
              href={FOOD_PAGE_PREFIX}
            >
              {FOOD_PAGE_CHROME[locale].footerLink}
            </Link>
          ) : null}
          <a
            className="rounded-sm text-caption text-kallo-stone transition-colors hover:text-kallo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent dark:hover:text-kallo-text"
            href={LINKEDIN_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            {tFooter('linkedin')}
          </a>
        </div>
      </div>
    </footer>
  );
}
