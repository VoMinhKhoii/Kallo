import { DocsFooter } from '@/components/docs/docs-footer';
import { DocsHeader } from '@/components/docs/docs-header';
import { LightOnly } from '@/components/providers/theme/light-only';
import type { Locale } from '@/i18n/config';
import { getSearchIndex } from '@/lib/domain/docs/search-index';
import { getDocsTree } from '@/lib/domain/docs/tree';

/**
 * The docs chrome — header with ⌘K search, the content column, and the footer
 * that carries the full page tree. Worn by the docs and by the public food
 * pages, so the two read as one surface.
 */
export async function DocsShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const sections = await getDocsTree(locale);
  const searchEntries = await getSearchIndex(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-kallo-surface">
      <LightOnly />
      <DocsHeader searchEntries={searchEntries} />

      <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 sm:px-6">
        {children}
      </div>

      <DocsFooter sections={sections} />
    </div>
  );
}
