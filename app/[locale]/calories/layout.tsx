import { DocsShell } from '@/components/docs/docs-shell';
import type { Locale } from '@/i18n/config';

/** Food pages wear the docs shell: same header, ⌘K search and footer tree. */
export default async function CaloriesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <DocsShell locale={locale as Locale}>{children}</DocsShell>;
}
