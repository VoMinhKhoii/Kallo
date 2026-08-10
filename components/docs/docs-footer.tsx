import { getTranslations } from 'next-intl/server';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { Link } from '@/i18n/navigation';
import type { DocsNavSection } from '@/lib/docs/tree';

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
 * `nham-stone` is the muted ink for this ground specifically. `nham-text-muted`
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

  return (
    <footer className={`bg-nham-ink ${landing ? '' : 'mt-24'}`}>
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
            <div key={section.id}>
              <h2 className="font-sans-display font-semibold text-base text-nham-surface">
                {tSections(section.id)}
              </h2>
              <ul className="mt-5 space-y-3.5">
                {section.links.map((link) => (
                  <li key={link.slug}>
                    <Link
                      className="rounded-sm font-sans-display text-base text-nham-stone transition-colors hover:text-nham-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
                      href={`/docs/${link.slug}`}
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-4 border-nham-stone/25 border-t pt-8">
          <Link
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
            href="/"
          >
            <KalloWordmark className="h-4 w-auto text-nham-surface" />
          </Link>
          <p className="text-caption text-nham-stone">
            {tFooter('copyright', { year: '2026' })}
          </p>
        </div>
      </div>
    </footer>
  );
}
