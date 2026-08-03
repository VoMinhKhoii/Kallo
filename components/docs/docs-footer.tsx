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
 * Section headings are the only bold text here; links sit muted until hovered,
 * so the columns read as a directory rather than as twenty-one competing calls
 * to action.
 */
export async function DocsFooter({ sections }: { sections: DocsNavSection[] }) {
  const t = await getTranslations('docs');
  const tSections = await getTranslations('docs.sections');
  const tFooter = await getTranslations('landing.footer');

  return (
    <footer className="mt-24 border-nham-border border-t">
      <div className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <nav
          aria-label={t('menu.label')}
          className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-4"
        >
          {sections.map((section) => (
            <div key={section.id}>
              <h2 className="font-sans-display font-semibold text-base text-nham-text">
                {tSections(section.id)}
              </h2>
              <ul className="mt-5 space-y-3.5">
                {section.links.map((link) => (
                  <li key={link.slug}>
                    <Link
                      className="rounded-sm font-sans-display text-base text-nham-text-muted transition-colors hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
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

        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-4 border-nham-border border-t pt-8">
          <Link
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
            href="/"
          >
            <KalloWordmark className="h-4 w-auto text-nham-text" />
          </Link>
          <p className="text-caption text-nham-text-muted">
            {tFooter('copyright', { year: '2026' })}
          </p>
        </div>
      </div>
    </footer>
  );
}
