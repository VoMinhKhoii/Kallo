import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/navigation';
import { SITE_URL } from '@/lib/site';

// Authenticated app surfaces. next-intl serves these under a locale prefix
// (/en/dashboard, /vi/dashboard, …), and robots path matching is a literal
// prefix from the start of the path, so each must be listed per-locale rather
// than as a bare /dashboard.
//
// `/admin` is deliberately NOT listed: adding it to robots.txt would publicly
// advertise the admin surface exists. It is already gated by ADMIN_EMAILS; a
// robots entry only helps an attacker enumerate it.
const AUTH_PATHS = [
  '/dashboard',
  '/settings',
  '/circle',
  '/nutrition',
  '/logging',
  '/onboarding',
];

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
          AUTH_PATHS.map((path) => `/${locale}${path}`)
        ),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
