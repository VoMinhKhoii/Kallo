import { setRequestLocale } from 'next-intl/server';
import { DocsFooter } from '@/components/docs/docs-footer';
import { DocsHeader } from '@/components/docs/docs-header';
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
 * There is no left sidebar: the full page tree lives in the footer, and ⌘K
 * search covers jumping without scrolling to it. The left-hand "on this page"
 * rail is rendered by the page rather than here, because its contents are
 * per-document — it occupies the column a section sidebar would have, but it
 * indexes the current document only.
 */
interface DocsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DocsLayout({
  children,
  params,
}: DocsLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sections = await getDocsTree(locale as Locale);
  const searchEntries = await getSearchIndex(locale as Locale);

  return (
    <div className="flex min-h-dvh flex-col bg-nham-surface">
      <DocsHeader searchEntries={searchEntries} />

      <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 sm:px-6">
        {children}
      </div>

      <DocsFooter sections={sections} />
    </div>
  );
}
