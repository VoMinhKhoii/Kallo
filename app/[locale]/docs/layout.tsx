import { DocsShell } from '@/components/docs/docs-shell';
import type { Locale } from '@/i18n/config';

/**
 * The docs shell — a separate surface from both the marketing landing page and
 * the authenticated app.
 *
 * It sits as a plain segment under `[locale]`, so it inherits `<html>`, the
 * fonts and the providers from the locale layout while picking up none of the
 * app chrome. The auth gate lives in `(app)/layout.tsx`, which this is a
 * sibling of, so /docs is public without touching the proxy.
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
  return <DocsShell locale={locale as Locale}>{children}</DocsShell>;
}
