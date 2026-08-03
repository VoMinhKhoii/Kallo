import type { ComponentType } from 'react';
import type { Locale } from '@/i18n/config';

/**
 * Slug → MDX module, resolved per locale.
 *
 * These are written out one by one rather than built from a template literal
 * (`import(\`…/${locale}/${slug}.mdx\`)`) on purpose: an explicit map is
 * statically analyzable by both Turbopack and webpack, and — more usefully —
 * TypeScript fails the build the moment a slug is added to `navigation.ts`
 * without its `.mdx` existing in BOTH locales. A dynamic import would defer
 * that to a runtime 404 on one language only, which is exactly the failure
 * nobody notices.
 */

export interface DocFrontmatter {
  title: string;
  description: string;
  /**
   * Hand-maintained, `YYYY-MM-DD`. Required on every page — the docs render a
   * revision stamp under each title, so a missing one leaves a hole. It is
   * deliberately NOT derived from git mtime: a formatting pass must never
   * restamp a legal document.
   */
  lastUpdated: string;
}

export interface DocModule {
  default: ComponentType;
  frontmatter: DocFrontmatter;
}

type DocRegistry = Record<string, () => Promise<DocModule>>;

const VI_DOCS: DocRegistry = {
  overview: () => import('@/content/docs/vi/overview.mdx'),
  quickstart: () => import('@/content/docs/vi/quickstart.mdx'),
  'profile-and-targets': () =>
    import('@/content/docs/vi/profile-and-targets.mdx'),
  'logging/describe-a-meal': () =>
    import('@/content/docs/vi/logging/describe-a-meal.mdx'),
  'logging/cheat-mode': () =>
    import('@/content/docs/vi/logging/cheat-mode.mdx'),
  'logging/manual': () => import('@/content/docs/vi/logging/manual.mdx'),
  'logging/barcode': () => import('@/content/docs/vi/logging/barcode.mdx'),
  'logging/relog': () => import('@/content/docs/vi/logging/relog.mdx'),
  'tracking/dashboard': () =>
    import('@/content/docs/vi/tracking/dashboard.mdx'),
  'tracking/weight': () => import('@/content/docs/vi/tracking/weight.mdx'),
  'tracking/nutrition': () =>
    import('@/content/docs/vi/tracking/nutrition.mdx'),
  'circle/friends-and-feed': () =>
    import('@/content/docs/vi/circle/friends-and-feed.mdx'),
  'circle/groups-and-chats': () =>
    import('@/content/docs/vi/circle/groups-and-chats.mdx'),
  'circle/sharing-and-splits': () =>
    import('@/content/docs/vi/circle/sharing-and-splits.mdx'),
  'account/settings': () => import('@/content/docs/vi/account/settings.mdx'),
  'account/premium': () => import('@/content/docs/vi/account/premium.mdx'),
  'account/your-data': () => import('@/content/docs/vi/account/your-data.mdx'),
  'estimates/how-it-works': () =>
    import('@/content/docs/vi/estimates/how-it-works.mdx'),
  'estimates/accuracy-and-limits': () =>
    import('@/content/docs/vi/estimates/accuracy-and-limits.mdx'),
  'legal/terms': () => import('@/content/docs/vi/legal/terms.mdx'),
  'legal/privacy': () => import('@/content/docs/vi/legal/privacy.mdx'),
};

const EN_DOCS: DocRegistry = {
  overview: () => import('@/content/docs/en/overview.mdx'),
  quickstart: () => import('@/content/docs/en/quickstart.mdx'),
  'profile-and-targets': () =>
    import('@/content/docs/en/profile-and-targets.mdx'),
  'logging/describe-a-meal': () =>
    import('@/content/docs/en/logging/describe-a-meal.mdx'),
  'logging/cheat-mode': () =>
    import('@/content/docs/en/logging/cheat-mode.mdx'),
  'logging/manual': () => import('@/content/docs/en/logging/manual.mdx'),
  'logging/barcode': () => import('@/content/docs/en/logging/barcode.mdx'),
  'logging/relog': () => import('@/content/docs/en/logging/relog.mdx'),
  'tracking/dashboard': () =>
    import('@/content/docs/en/tracking/dashboard.mdx'),
  'tracking/weight': () => import('@/content/docs/en/tracking/weight.mdx'),
  'tracking/nutrition': () =>
    import('@/content/docs/en/tracking/nutrition.mdx'),
  'circle/friends-and-feed': () =>
    import('@/content/docs/en/circle/friends-and-feed.mdx'),
  'circle/groups-and-chats': () =>
    import('@/content/docs/en/circle/groups-and-chats.mdx'),
  'circle/sharing-and-splits': () =>
    import('@/content/docs/en/circle/sharing-and-splits.mdx'),
  'account/settings': () => import('@/content/docs/en/account/settings.mdx'),
  'account/premium': () => import('@/content/docs/en/account/premium.mdx'),
  'account/your-data': () => import('@/content/docs/en/account/your-data.mdx'),
  'estimates/how-it-works': () =>
    import('@/content/docs/en/estimates/how-it-works.mdx'),
  'estimates/accuracy-and-limits': () =>
    import('@/content/docs/en/estimates/accuracy-and-limits.mdx'),
  'legal/terms': () => import('@/content/docs/en/legal/terms.mdx'),
  'legal/privacy': () => import('@/content/docs/en/legal/privacy.mdx'),
};

const REGISTRY: Record<Locale, DocRegistry> = {
  vi: VI_DOCS,
  en: EN_DOCS,
};

export async function loadDoc(
  locale: Locale,
  slug: string
): Promise<DocModule | null> {
  const load = REGISTRY[locale]?.[slug];
  if (!load) return null;

  return await load();
}

/** Frontmatter only — used by the sidebar, pager, hub and search index. */
export async function loadFrontmatter(
  locale: Locale,
  slug: string
): Promise<DocFrontmatter | null> {
  const doc = await loadDoc(locale, slug);

  return doc?.frontmatter ?? null;
}
