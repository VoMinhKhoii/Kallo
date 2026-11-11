import { DocsShell } from '@/components/docs/docs-shell';
import type { Locale } from '@/i18n/config';

/** Comparison pages wear the docs shell, like the alternatives pages. */
export default async function CompareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <DocsShell locale={locale as Locale}>{children}</DocsShell>;
}
