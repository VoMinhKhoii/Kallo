import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/navigation';
import { ROBOTS_DISALLOWED_PREFIXES } from '@/lib/seo/private-paths';
import { SITE_URL } from '@/lib/seo/site';

// Authenticated app surfaces. next-intl serves these under a locale prefix
// (/en/dashboard, /vi/dashboard, …), and robots path matching is a literal
// prefix from the start of the path, so each must be listed per-locale rather
// than as a bare /dashboard.
//
// The list itself lives in lib/seo/private-paths.ts because markdown content
// negotiation needs the same set (it must let these fall through to HTML rather
// than answering with a markdown 404), and two hand-kept copies would drift.
// `/admin` is filtered out there: listing it in robots.txt would publicly
// advertise that an admin surface exists.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Machine + auth endpoints are locale-agnostic (excluded from next-intl
        // rewriting), so they are not locale-prefixed.
        '/api/',
        '/auth/',
        ...routing.locales.flatMap((locale) =>
          ROBOTS_DISALLOWED_PREFIXES.map((path) => `/${locale}${path}`)
        ),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
