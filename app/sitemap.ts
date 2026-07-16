import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/navigation';
import { SITE_URL } from '@/lib/site';

// Only the publicly crawlable, unauthenticated surfaces belong here. Everything
// behind auth (dashboard, settings, groups, …) is disallowed in robots.ts.
const PUBLIC_PATHS = ['', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: path === '' ? 1 : 0.5,
    }))
  );
}
