import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/navigation';
import { DOCS_SLUGS } from '@/lib/docs/navigation';
import { SITE_URL } from '@/lib/site';

// Only the publicly crawlable, unauthenticated surfaces belong here. Everything
// behind auth (dashboard, settings, groups, …) is disallowed in robots.ts.
//
// The docs paths are derived from the docs nav rather than listed by hand, so
// adding a page cannot leave the sitemap behind. /privacy and /terms are gone:
// they now live under /docs/legal and the old paths 308 there (next.config.ts).
const PUBLIC_PATHS = ['', ...DOCS_SLUGS.map((slug) => `/docs/${slug}`)];

function priorityFor(path: string): number {
  if (path === '') return 1;

  return 0.5;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: priorityFor(path),
    }))
  );
}
