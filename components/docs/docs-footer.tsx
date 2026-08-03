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
export async function DocsFooter({ sections }: { sections: DocsNavSection[] }) {
  const t = await getTranslations('docs');
  const tSections = await getTranslations('docs.sections');
  const tFooter = await getTranslations('landing.footer');

  return (
    <footer className="mt-24 bg-nham-ink">
      <div className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
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
