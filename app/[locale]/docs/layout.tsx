import { setRequestLocale } from 'next-intl/server';
import { DocsHeader } from '@/components/docs/docs-header';
import { DocsSidebar } from '@/components/docs/docs-sidebar';
import type { Locale } from '@/i18n/config';
import { getSearchIndex } from '@/lib/docs/search-index';
import { getDocsTree } from '@/lib/docs/tree';

/**
 * The docs shell — a separate surface from both the marketing landing page and
 * the authenticated app.
 *
 * It sits as a plain segment under `[locale]`, so it inherits `<html>`, the
 * fonts and the providers from the locale layout while picking up none of the
 * app chrome. The auth gate lives in `(app)/layout.tsx`, which this is a
 * sibling of, so /docs is public without touching middleware.
 *
 * The right-hand "on this page" rail is rendered by the page rather than here,
 * because its contents are per-document.
 */
export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sections = await getDocsTree(locale as Locale);
  const searchEntries = await getSearchIndex(locale as Locale);

  return (
    <div className="min-h-dvh bg-nham-surface">
      <DocsHeader searchEntries={searchEntries} sections={sections} />

      <div className="mx-auto max-w-[90rem] px-4 sm:px-6">
        <div className="flex gap-8">
          <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto py-10 pr-2 lg:block">
            <DocsSidebar sections={sections} />
          </aside>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
