import { getTranslations } from 'next-intl/server';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { DocsLocaleToggle } from '@/components/docs/docs-locale-toggle';
import { DocsMobileNav } from '@/components/docs/docs-mobile-nav';
import { DocsSearch } from '@/components/docs/docs-search';
import { Link } from '@/i18n/navigation';
import type { DocsSearchEntry } from '@/lib/docs/search-index';
import type { DocsNavSection } from '@/lib/docs/tree';

/**
 * The docs bar — the thing that makes /docs read as a separate surface from
 * both the marketing site and the app shell.
 *
 * Sticky rather than fixed, so it participates in the page grid and never
 * needs a spacer. The one hairline bottom border does the separating; no blur,
 * no shadow.
 *
 * The wordmark's capital IS the Kallo mark, so the mark is never placed beside
 * it — the "Tài liệu" label sits after a thin divider instead.
 */
export async function DocsHeader({
  sections,
  searchEntries,
}: {
  sections: DocsNavSection[];
  searchEntries: DocsSearchEntry[];
}) {
  const t = await getTranslations('docs');

  return (
    <header className="sticky top-0 z-40 border-nham-border border-b bg-nham-surface">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
        <DocsMobileNav sections={sections} />

        <Link
          className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
          href="/docs"
        >
          <KalloWordmark className="h-4 w-auto text-nham-text" />
          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-nham-border sm:block"
          />
          <span className="hidden font-serif text-[15px] text-nham-text-muted sm:block">
            {t('title')}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <DocsSearch entries={searchEntries} />
          <DocsLocaleToggle />
          <Link
            className="hidden h-9 items-center rounded-lg bg-nham-btn px-3.5 font-medium font-sans-display text-[13px] text-nham-surface transition-colors hover:bg-nham-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent sm:flex"
            href="/"
          >
            {t('openApp')}
          </Link>
        </div>
      </div>
    </header>
  );
}
