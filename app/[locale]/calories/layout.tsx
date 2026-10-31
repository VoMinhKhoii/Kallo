import { DocsFooter } from '@/components/docs/docs-footer';
import { DocsHeader } from '@/components/docs/docs-header';
import { LightOnly } from '@/components/providers/theme/light-only';
import type { Locale } from '@/i18n/config';
import { getSearchIndex } from '@/lib/domain/docs/search-index';
import { getDocsTree } from '@/lib/domain/docs/tree';

/** Food pages wear the docs shell: same header, ⌘K search and footer tree. */
export default async function CaloriesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sections = await getDocsTree(locale as Locale);
  const searchEntries = await getSearchIndex(locale as Locale);

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
